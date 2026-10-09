extends Node

signal action_dispatched(action: Dictionary)
signal tick_advanced(tick: int)
signal capture_checkpoint(name: String, tick: int)
signal replay_finished(tick: int)

const REPLAY_PATH := "res://talarion_runtime/replay.json"
# Allow external screenshot runners to capture the same stable rendered checkpoint.
const CAPTURE_HOLD_TICKS := 90

var tick_rate: int = 60
var replay_seed: int = 0
var current_tick: int = 0

var _events: Array = []
var _event_index: int = 0
var _active := false
var _capture_hold_remaining: int = 0

func _ready() -> void:
    if load_replay(REPLAY_PATH):
        start_replay()

func load_replay(path: String) -> bool:
    if not FileAccess.file_exists(path):
        push_error("TALARION_REPLAY_MISSING " + path)
        return false

    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        push_error("TALARION_REPLAY_OPEN_FAILED " + path)
        return false

    var parsed = JSON.parse_string(file.get_as_text())
    if typeof(parsed) != TYPE_DICTIONARY:
        push_error("TALARION_REPLAY_INVALID root")
        return false

    if parsed.get("schema", "") != "talarion.replay/v1":
        push_error("TALARION_REPLAY_INVALID schema")
        return false

    tick_rate = int(parsed.get("tickRate", 60))
    if tick_rate <= 0:
        push_error("TALARION_REPLAY_INVALID tickRate")
        return false

    replay_seed = int(parsed.get("seed", 0))
    _events = parsed.get("events", [])
    if typeof(_events) != TYPE_ARRAY:
        push_error("TALARION_REPLAY_INVALID events")
        return false

    var previous_tick := -1
    for event in _events:
        if typeof(event) != TYPE_DICTIONARY:
            push_error("TALARION_REPLAY_INVALID event")
            return false
        var event_tick := int(event.get("tick", -1))
        if event_tick < 0 or event_tick < previous_tick:
            push_error("TALARION_REPLAY_INVALID order")
            return false
        previous_tick = event_tick

    Engine.physics_ticks_per_second = tick_rate
    seed(replay_seed)
    print("TALARION_REPLAY_READY " + JSON.stringify({
        "tickRate": tick_rate,
        "seed": replay_seed,
        "events": _events.size()
    }))
    return true

func start_replay() -> void:
    current_tick = 0
    _event_index = 0
    _active = true
    _capture_hold_remaining = 0

func _physics_process(_delta: float) -> void:
    if not _active:
        return
    if _capture_hold_remaining > 0:
        _capture_hold_remaining -= 1
        return

    var pending_captures: Array[String] = []
    while _event_index < _events.size():
        var event: Dictionary = _events[_event_index]
        var event_tick := int(event.get("tick", -1))
        if event_tick > current_tick:
            break
        if event_tick < current_tick:
            push_error("TALARION_REPLAY_SKIPPED " + JSON.stringify(event))
            _event_index += 1
            continue

        var event_type := String(event.get("type", ""))
        if event_type == "capture":
            pending_captures.append(String(event.get("name", "checkpoint")))
        else:
            action_dispatched.emit(event)

        _event_index += 1

    # Finalize this tick before emitting capture markers. Hold authoritative
    # replay time while the browser / ADB screenshot is collected.
    tick_advanced.emit(current_tick)
    for checkpoint_name in pending_captures:
        capture_checkpoint.emit(checkpoint_name, current_tick)
    if not pending_captures.is_empty():
        _capture_hold_remaining = CAPTURE_HOLD_TICKS

    if _event_index >= _events.size():
        _active = false
        replay_finished.emit(current_tick)
        print("TALARION_REPLAY_FINISHED " + str(current_tick))

    current_tick += 1
