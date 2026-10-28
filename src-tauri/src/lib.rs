use std::time::Duration;
mod reminders;

async fn fetch_api(path: &str) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|_| "Не удалось создать подключение".to_owned())?;
    let response = client
        .get(format!("https://rasp-api.rsue.ru/api/v1/schedule/{path}"))
        .send()
        .await
        .map_err(|_| "Нет связи с университетом".to_owned())?
        .error_for_status()
        .map_err(|_| "Сервер расписания временно недоступен".to_owned())?;
    response
        .json()
        .await
        .map_err(|_| "Сервер вернул некорректное расписание".to_owned())
}

#[tauri::command]
async fn fetch_groups() -> Result<serde_json::Value, String> {
    fetch_api("search/").await
}

#[tauri::command]
async fn fetch_schedule(group: String) -> Result<serde_json::Value, String> {
    if group.is_empty() || group.chars().count() > 64 || group.chars().any(char::is_control) {
        return Err("Некорректная группа".to_owned());
    }
    let mut url = reqwest::Url::parse("https://rasp-api.rsue.ru/api/v1/schedule/lessons/")
        .map_err(|_| "Некорректный адрес".to_owned())?;
    url.path_segments_mut()
        .map_err(|_| "Некорректный адрес".to_owned())?
        .pop_if_empty()
        .push(&group)
        .push("");
    let path = url
        .path()
        .strip_prefix("/api/v1/schedule/")
        .ok_or("Некорректный адрес")?;
    fetch_api(path).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(reminders::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fetch_schedule,
            fetch_groups,
            reminders::reminder_access
        ])
        .run(tauri::generate_context!())
        .expect("error while running Расписание РИНХ");
}
