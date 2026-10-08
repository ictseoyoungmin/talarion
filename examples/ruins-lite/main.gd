extends Node3D

# TL00 sample state emitter.
# The real Web/Android runners will inject replay events through a dedicated bridge.
# For now this scene provides deterministic fixed-tick state output for contract work.

const SPEED := 2.0
var tick := 0
var state := "IDLE"
@onready var player: MeshInstance3D = $Player

func _ready() -> void:
    Engine.physics_ticks_per_second = 60
    _emit_state()

func _physics_process(delta: float) -> void:
    tick += 1
    var input_vec := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    if input_vec.length() > 0.0:
        state = "RUN"
        player.position += Vector3(input_vec.x, 0.0, input_vec.y) * SPEED * delta
    else:
        state = "IDLE"

    if tick % 60 == 0:
        _emit_state()

func _emit_state() -> void:
    var payload := {
        "tick": tick,
        "entity": "player",
        "state": state,
        "position": [player.position.x, player.position.y, player.position.z],
        "rotation": [player.rotation.x, player.rotation.y, player.rotation.z],
        "health": 100.0
    }
    print("TALARION_STATE " + JSON.stringify(payload))
