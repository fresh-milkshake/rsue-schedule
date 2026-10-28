package ru.rsuer.rhythm

import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class ReminderAccessPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun access(invoke: Invoke) {
    val action = invoke.getArgs().optString("action", "status")
    if (action == "exact" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      activity.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:${activity.packageName}")))
    } else if (action == "settings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        activity.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName))
      } else {
        activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${activity.packageName}")))
      }
    }
    val alarms = activity.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val result = JSObject()
    result.put("android", true)
    result.put("exact", Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms())
    val channelEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.getNotificationChannel("schedule")?.importance != NotificationManager.IMPORTANCE_NONE
    } else true
    result.put("enabled", NotificationManagerCompat.from(activity).areNotificationsEnabled() && channelEnabled)
    val insets = ViewCompat.getRootWindowInsets(activity.window.decorView)
      ?.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
    val density = activity.resources.displayMetrics.density
    result.put("safeTop", (insets?.top ?: 0) / density)
    result.put("safeBottom", (insets?.bottom ?: 0) / density)
    invoke.resolve(result)
  }
}
