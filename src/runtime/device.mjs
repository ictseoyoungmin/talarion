// Privacy-safe Android runtime identity. Do not persist ADB serial, Android ID,
// account data, IMEI, host username or full dumpsys output in public CI artifacts.
export function parseAndroidDeviceInfo(propsText, displayText = "") {
  const props = new Map();
  for (const line of String(propsText).split(/\r?\n/)) {
    const match = line.match(/^\[([^\]]+)\]: \[([^\]]*)\]/);
    if (match) props.set(match[1], match[2]);
  }
  const get = key => props.get(key) || null;
  const model = get("ro.product.model");
  const emulatorValue = get("ro.kernel.qemu") ?? get("ro.boot.qemu");
  const isEmulator = emulatorValue === "1" ? true :
    emulatorValue === "0" ? false :
    model && /sdk_gphone|sdk_phone|emulator|android sdk/i.test(model) ? true : null;
  const gl = String(displayText).split(/\r?\n/).find(line => /GLES:/.test(line));
  const gles = gl ? gl.slice(gl.indexOf("GLES:") + 5).trim().slice(0, 256) : null;
  return {
    schema: "talarion.android-device/v1", isEmulator,
    model, manufacturer: get("ro.product.manufacturer"),
    apiLevel: Number(get("ro.build.version.sdk")) || null,
    buildFingerprint: get("ro.build.fingerprint"),
    hardware: get("ro.hardware"), gles
  };
}
