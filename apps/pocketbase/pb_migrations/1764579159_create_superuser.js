/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const encryptionKey = $os.getenv("PB_ENCRYPTION_KEY")
    const emailEncrypted = $os.getenv("PB_SUPERUSER_EMAIL")
    const passwordEncrypted = $os.getenv("PB_SUPERUSER_PASSWORD")

    if (!encryptionKey || !emailEncrypted || !passwordEncrypted) {
        return
    }

    try {
        const email = $security.decrypt(emailEncrypted, encryptionKey)
        const password = $security.decrypt(passwordEncrypted, encryptionKey)

        const superusers = app.findCollectionByNameOrId("_superusers")
        const record = new Record(superusers)

        record.set("email", email)
        record.set("password", password)

        app.save(record)
    } catch (err) {
        // Si no hay credenciales válidas, dejamos el arranque sin romper la app.
        // El primer superusuario se puede crear desde la UI de PocketBase.
    }
})
