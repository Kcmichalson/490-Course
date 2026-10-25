    --[[ AIT exporter (tts/exporter.lua): object script for the "AIT Bridge" object.
    
    Install: in TTS, right-click the AIT Bridge object > Scripting > Scripting
    Editor, paste this whole file, click Save & Play, then save the game.
    TTS stores the script inside the save; editing this file on disk does
    nothing until you paste it again.
    
    What it does (SPEC.md §2): every 5 s, and when the host clicks the Snapshot
    button, it POSTs every object whose first non-blank description line starts
    with "ait:" to the bridge at http://127.0.0.1:8765/tts, on this computer
    only. All parsing and hex math happen in the bridge (Python). Lua runs only
    on the host, so the bridge must run on the host's computer.
    
    Lines marked VERIFY are TTS behaviors not yet checked in the game (M2
    checklist).
    ]]
    
    local BRIDGE_URL = "http://127.0.0.1:8765/tts"
    local INTERVAL_S = 5
    local REQUEST_TIMEOUT_S = 10
    
    local inFlight = false
    local requestId = 0
    local bridgeState = "unknown"   -- "unknown" | "online" | "offline"
    local lastRejection = nil
    local lastNotice = {}           -- kind -> last message shown
    
    -- VERIFY: print() shows only to the host.
    local function hostPrint(message)
        print("AIT: " .. message)
    end
    
    -- Show a message once; show it again only if it changes. Used for Lua
    -- errors so they never repeat every timer tick.
    local function noticeOnce(kind, message)
        if lastNotice[kind] ~= message then
            lastNotice[kind] = message
            hostPrint(message)
        end
    end
    
    local SPACE = {[9] = true, [10] = true, [11] = true, [12] = true,
                   [13] = true, [32] = true}   -- \t \n \v \f \r and space
    
    -- Matches the bridge: skip leading whitespace and blank lines, then the
    -- text must start with "ait", optional spaces or tabs, and ":" (any case).
    -- TTS QUIRK: no Lua patterns here. MoonSharp's pattern matcher fails with
    -- "pattern too complex" on long strings (e.g. rules cards), so this uses
    -- byte comparisons and a short substring only.
    local function isMarked(description)
        if type(description) ~= "string" then return false end
        local i, n = 1, #description
        while i <= n and SPACE[description:byte(i)] do
            i = i + 1
        end
        local head = description:sub(i, i + 39):lower()
        if head:sub(1, 3) ~= "ait" then return false end
        local j = 4
        while head:sub(j, j) == " " or head:sub(j, j) == "\t" do
            j = j + 1
        end
        return head:sub(j, j) == ":"
    end
    
    -- Plain tables, because JSON.encode may not handle TTS Vector objects.
    local function vec(v)
        return {x = v.x, y = v.y, z = v.z}
    end
    
    -- Each Grid field is read on its own, inside pcall: reading one that
    -- doesn't exist may raise an error, which used to drop the whole grid.
    -- Readable fields go in "grid"; the rest are listed in "grid_unreadable"
    -- and shown in chat once. The bridge uses the grid only when there are
    -- no calibration markers. VERIFY: which fields exist.
    local GRID_FIELDS = {"type", "sizeX", "sizeY", "offsetX", "offsetY", "offsetZ"}

    local function gridSettings()
        local grid, unreadable, firstError = {}, {}, nil
        for _, field in ipairs(GRID_FIELDS) do
            local ok, value = pcall(function() return Grid[field] end)
            if ok and value ~= nil then
                grid[field] = value
            else
                table.insert(unreadable, field)
                if not ok and not firstError then
                    firstError = field .. ": " .. tostring(value)
                end
            end
        end
        return grid, unreadable, firstError
    end
    
    -- One object's entry, or nil if it isn't marked.
    local function describe(obj)
        local description = obj.getDescription()
        if not isMarked(description) then return nil end
        local bounds = obj.getBounds()   -- VERIFY: world-aligned box
        return {
            guid = obj.getGUID(),
            name = obj.getName(),
            description = description,
            position = vec(obj.getPosition()),
            rotation = vec(obj.getRotation()),
            bounds = {center = vec(bounds.center), size = vec(bounds.size)},
            held_by_color = obj.held_by_color,   -- VERIFY: nil or "" when not held
            resting = obj.resting,               -- VERIFY: false while moving
        }
    end
    
    -- Each object is checked inside pcall, so one bad object is skipped
    -- instead of stopping the whole export.
    local function collect()
        local objects, skipped, firstError = {}, 0, nil
        for _, obj in ipairs(getObjects()) do
            local ok, entry = pcall(describe, obj)
            if not ok then
                skipped = skipped + 1
                firstError = firstError or tostring(entry)
            elseif entry then
                table.insert(objects, entry)
            end
        end
        if skipped > 0 then
            noticeOnce("skipped", "skipped " .. skipped .. " object(s) with a Lua error: "
                       .. firstError)
        end
        return objects
    end
    
    -- Built by hand so an empty object list is sent as [] (JSON.encode may
    -- turn an empty table into {}).
    local function encodePayload(trigger, objects)
        local parts = {
            '"payload_version":2',
            '"exporter":"ait-exporter/0.3"',
            '"trigger":"' .. trigger .. '"',
            '"objects":' .. (#objects == 0 and "[]" or JSON.encode(objects)),
        }
        local grid, unreadable, firstError = gridSettings()
        if next(grid) ~= nil then
            table.insert(parts, '"grid":' .. JSON.encode(grid))
        end
        if #unreadable > 0 then
            -- Field names are fixed ASCII, so they're written out directly.
            table.insert(parts, '"grid_unreadable":["'
                         .. table.concat(unreadable, '","') .. '"]')
            noticeOnce("grid", "couldn't read TTS Grid field(s): "
                       .. table.concat(unreadable, ", ")
                       .. (firstError and (" (" .. firstError .. ")") or ""))
        end
        return "{" .. table.concat(parts, ",") .. "}"
    end
    
    local function rejectionText(request)
        local text = request.text or ""
        local ok, decoded = pcall(JSON.decode, text)
        if ok and type(decoded) == "table" and decoded.error then
            return decoded.error
        end
        if text == "" then return "HTTP " .. tostring(request.response_code) end
        return text:sub(1, 200)
    end
    
    local function onResponse(request, trigger, count, id)
        if id == requestId then inFlight = false end
        local code = request.response_code or 0
        -- A 4xx means the bridge answered but refused the payload: show the
        -- reason once (until it changes), not as "offline".
        if code >= 400 then
            bridgeState = "online"
            local message = rejectionText(request)
            if message ~= lastRejection then
                hostPrint("the bridge rejected the snapshot: " .. message)
                lastRejection = message
            end
            return
        end
        if request.is_error or code == 0 then
            if bridgeState ~= "offline" then
                hostPrint("bridge not reachable at 127.0.0.1:8765; will keep trying quietly.")
                bridgeState = "offline"
            end
            return
        end
        if bridgeState == "offline" then
            hostPrint("bridge reconnected.")
        end
        bridgeState = "online"
        lastRejection = nil
        if trigger == "button" then
            hostPrint("snapshot sent (" .. count .. " objects).")
        end
    end
    
    local function sendNow(trigger)
        local objects = collect()
        local body = encodePayload(trigger, objects)
        inFlight = true
        requestId = requestId + 1
        local id = requestId
        -- If the request never comes back, stop waiting for it.
        Wait.time(function()
            if inFlight and requestId == id then inFlight = false end
        end, REQUEST_TIMEOUT_S)
        -- VERIFY: WebRequest.custom(url, method, download, data, headers, callback)
        WebRequest.custom(BRIDGE_URL, "POST", true, body,
            {["Content-Type"] = "application/json"},
            function(request)
                local ok, err = pcall(onResponse, request, trigger, #objects, id)
                if not ok then
                    inFlight = false
                    noticeOnce("response", "Lua error handling the bridge's reply: "
                               .. tostring(err))
                end
            end)
    end
    
    -- Returns "sent", "busy" (a request is still pending), or "error". Lua
    -- errors are shown in chat once (again only if the message changes).
    local function send(trigger)
        if inFlight then return "busy" end
        local ok, err = pcall(sendNow, trigger)
        if not ok then
            inFlight = false
            noticeOnce("send", "Lua error while exporting: " .. tostring(err))
            return "error"
        end
        return "sent"
    end
    
    function onLoad()
        -- VERIFY: where the button appears depends on the object's shape.
        self.createButton({
            click_function = "onSnapshotClick", function_owner = self,
            label = "Snapshot", tooltip = "Send a snapshot to the AIT bridge (host only)",
            position = {0, 0.3, 0}, rotation = {0, 180, 0},
            width = 1400, height = 450, font_size = 220,
        })
        -- VERIFY: repetitions -1 repeats forever.
        Wait.time(function() send("timer") end, INTERVAL_S, -1)
        hostPrint("exporter loaded; sending to 127.0.0.1:8765 every " .. INTERVAL_S .. " s.")
    end
    
    -- Button clicks run on the host for every player; only the host's count.
    function onSnapshotClick(obj, playerColor, altClick)
        local player = Player[playerColor]
        if not (player and player.host) then   -- VERIFY: Player[color].host
            printToColor("AIT: only the host can send a snapshot.", playerColor)
            return
        end
        if send("button") == "busy" then
            hostPrint("a snapshot is already on its way; try again in a moment.")
        end
    end
