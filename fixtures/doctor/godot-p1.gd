extends Node
func demo():
    JavaScriptBridge.eval("42")
    Engine.get_singleton("AndroidRuntime")
    JavaClassWrapper.wrap("android.os.Build")
    OS.execute("echo", [])
    Input.is_physical_key_pressed(KEY_W)
