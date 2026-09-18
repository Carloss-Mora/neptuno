
/// <reference path="../pb_data/types.d.ts" />
onMailerSend((e) => {
    if (e.app.settings().smtp.enabled) {
        return e.next()
    }

    const senderAddress = $os.getenv("BUILDER_MAILER_SENDER_ADDRESS");
    const apiUrl = ($os.getenv("BUILDER_MAILER_API_URL") || "https://api.resend.com").replace(/\/+$/, "");
    const apiKey = $os.getenv("BUILDER_MAILER_API_KEY");

    if (!senderAddress || !apiKey) {
        throw new Error('Falta la configuración del servicio de correo. Revisa BUILDER_MAILER_SENDER_ADDRESS y BUILDER_MAILER_API_KEY.');
    }

    const emailTarget = e.message.to?.[0]?.address || e.message.to || '';
    const payload = {
        from: senderAddress,
        to: Array.isArray(emailTarget) ? emailTarget.map((item) => item.address || item) : [emailTarget],
        subject: e.message.subject || 'Sin asunto',
        html: e.message.html || `<p>${(e.message.text || '').replace(/\n/g, '<br/>')}</p>`,
        text: e.message.text || '',
    };

    const response = $http.send({
        url: `${apiUrl}/emails`,
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (response.statusCode >= 400) {
        const errorMessage = response.json?.message || response.json?.error || response.text || 'No se pudo enviar el correo.';
        $app.logger().error("Failed to send email", "error", response.json || response.text);
        throw new ApiError(response.statusCode || 500, `No se pudo enviar el correo: ${errorMessage}`);
    }
})
