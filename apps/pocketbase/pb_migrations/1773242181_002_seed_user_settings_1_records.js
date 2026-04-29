/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("user_settings");

  const record0 = new Record(collection);
    record0.set("userId", "test_user_001");
    record0.set("irrigation_schedule_times", "06:00,18:00");
    record0.set("preferences", "{\"theme\": \"dark\", \"notifications\": true, \"alert_threshold\": 30}");
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  // Rollback: record IDs not known, manual cleanup needed
})
