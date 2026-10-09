extends Node3D

const SPEED := 2.0
const JUMP_TICKS := 36
const ACTION_TICKS := 20

var move_vector := Vector2.ZERO
var state := "IDLE"
var jump_started_tick := -1
var transient_state_until := -1

@onready var player: MeshInstance3D = $Player
@onready var camera: Camera3D = $Camera3D

var _idle_material: Material
var _interact_material: StandardMaterial3D
var _attack_material: StandardMaterial3D

func _ready() -> void:
    _idle_material = player.material_override
    _interact_material = StandardMaterial3D.new()
    _interact_material.albedo_color = Color(0.16, 0.83, 0.75, 1.0)
    _attack_material = StandardMaterial3D.new()
    _attack_material.albedo_color = Color(0.97, 0.31, 0.18, 1.0)
    TalarionBridge.action_dispatched.connect(_on_action)
    TalarionBridge.tick_advanced.connect(_on_tick)
    TalarionBridge.capture_checkpoint.connect(_on_capture_checkpoint)
    TalarionBridge.replay_finished.connect(_on_replay_finished)
    _emit_state(0, "start")

func _on_action(action: Dictionary) -> void:
    var action_type := String(action.get("type", ""))

    match action_type:
        "session.start":
            move_vector = Vector2.ZERO
            state = "IDLE"
        "session.end":
            move_vector = Vector2.ZERO
        "move":
            var value = action.get("value", [0.0, 0.0])
            if value is Array and value.size() >= 2:
                move_vector = Vector2(float(value[0]), float(value[1]))
        "camera":
            var value = action.get("value", [0.0, 0.0])
            if value is Array and value.size() >= 2:
                camera.rotation.y += float(value[0])
                camera.rotation.x += float(value[1])
        "jump":
            if bool(action.get("pressed", true)):
                jump_started_tick = TalarionBridge.current_tick
                state = "JUMP"
        "interact":
            state = "INTERACT"
            transient_state_until = TalarionBridge.current_tick + ACTION_TICKS
            print("TALARION_EVENT " + JSON.stringify({
                "tick": TalarionBridge.current_tick,
                "type": "interact",
                "entity": action.get("entity", "")
            }))
        "attack":
            state = "ATTACK"
            transient_state_until = TalarionBridge.current_tick + ACTION_TICKS
            print("TALARION_EVENT " + JSON.stringify({
                "tick": TalarionBridge.current_tick,
                "type": "attack",
                "kind": action.get("kind", "")
            }))

func _on_tick(tick: int) -> void:
    var delta := 1.0 / float(TalarionBridge.tick_rate)

    if move_vector.length() > 0.0:
        player.position += Vector3(move_vector.x, 0.0, move_vector.y) * SPEED * delta

    if jump_started_tick >= 0:
        var elapsed := tick - jump_started_tick
        if elapsed <= JUMP_TICKS:
            var phase: float = clampf(float(elapsed) / float(JUMP_TICKS), 0.0, 1.0)
            player.position.y = 0.8 + sin(phase * PI) * 0.75
            state = "JUMP"
        else:
            player.position.y = 0.8
            jump_started_tick = -1

    if jump_started_tick < 0 and tick > transient_state_until:
        state = "RUN" if move_vector.length() > 0.0 else "IDLE"

    # TL00 sample: the visual gate must inspect the actual interaction and
    # attack states, not two indistinguishable idle frames.
    if state == "INTERACT":
        player.material_override = _interact_material
    elif state == "ATTACK":
        player.material_override = _attack_material
    else:
        player.material_override = _idle_material

    if tick > 0 and tick % TalarionBridge.tick_rate == 0:
        _emit_state(tick, "interval")
        # Observed renderer/process counters, not authoritative replay state.
        # Keep performance evidence separate from the deterministic state gate.
        print("TALARION_PERF " + JSON.stringify({
            "tick": tick,
            "fps": Engine.get_frames_per_second(),
            "processMs": 1000.0 * Performance.get_monitor(Performance.TIME_PROCESS),
            "physicsMs": 1000.0 * Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS),
            "memoryBytes": int(Performance.get_monitor(Performance.MEMORY_STATIC))
        }))

func _on_capture_checkpoint(name: String, tick: int) -> void:
    _emit_state(tick, name)
    print("TALARION_CAPTURE " + JSON.stringify({
        "tick": tick,
        "name": name
    }))

func _on_replay_finished(tick: int) -> void:
    _emit_state(tick, "end")

func _emit_state(tick: int, checkpoint: String) -> void:
    var payload := {
        "tick": tick,
        "entity": "player",
        "state": state,
        "checkpoint": checkpoint,
        "position": [player.position.x, player.position.y, player.position.z],
        "rotation": [player.rotation.x, player.rotation.y, player.rotation.z],
        "cameraRotation": [camera.rotation.x, camera.rotation.y, camera.rotation.z],
        "health": 100.0
    }
    print("TALARION_STATE " + JSON.stringify(payload))
