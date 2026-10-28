use tauri::Runtime;

#[cfg(target_os = "android")]
use tauri::Manager;

pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("reminder-access")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle =
                    _api.register_android_plugin("ru.rsuer.rhythm", "ReminderAccessPlugin")?;
                _app.manage(handle);
            }
            Ok(())
        })
        .build()
}

#[tauri::command]
pub async fn reminder_access(
    _app: tauri::AppHandle,
    action: String,
) -> Result<serde_json::Value, String> {
    if !["status", "exact", "settings"].contains(&action.as_str()) {
        return Err("Неизвестное действие".to_owned());
    }
    #[cfg(target_os = "android")]
    {
        let handle = _app.state::<tauri::plugin::PluginHandle<tauri::Wry>>();
        handle
            .run_mobile_plugin("access", serde_json::json!({ "action": action }))
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "android"))]
    Ok(serde_json::json!({ "android": false, "exact": false, "enabled": false }))
}
