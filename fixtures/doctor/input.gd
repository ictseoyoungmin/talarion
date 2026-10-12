extends Node
# Input.is_key_pressed(KEY_A)
var ignored = "Input.is_key_pressed(KEY_B)"
var long_ignored = """
Input.is_key_pressed(KEY_C)
"""
func _process(_dt):
    if Input.is_key_pressed(KEY_D):
        pass
