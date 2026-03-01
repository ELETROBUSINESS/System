/**
 * ELETRO - Motor de Envio V7 (Premium Resilience)
 * Nome do remetente: ELETRO
 */

function doPost(e) {
    var params = {};

    try {
        // 1. Captura Híbrida de Parâmetros (Merge Parameter + PostData)
        // Isso resolve o problema de truncamento do GAS em campos grandes (corpoHtml)
        if (e.parameter) {
            for (var key in e.parameter) {
                params[key] = e.parameter[key];
            }
        }

        if (e.postData && e.postData.contents) {
            var raw = e.postData.contents;
            try {
                // Tenta como JSON (Formato mais seguro para dados complexos)
                var json = JSON.parse(raw);
                for (var key in json) {
                    params[key] = json[key];
                }
            } catch (errJson) {
                // Fallback robusto para Form-Urlencoded manual
                if (raw.indexOf('=') > -1) {
                    raw.split('&').forEach(function (pair) {
                        var sep = pair.indexOf('=');
                        if (sep > -1) {
                            var k = decodeURIComponent(pair.substring(0, sep));
                            var v = decodeURIComponent(pair.substring(sep + 1));
                            params[k] = v;
                        }
                    });
                }
            }
        }

        var to = params.destinatario;
        var subject = params.assunto || "Notificação ELETRO";
        var html = params.corpoHtml;

        console.log("Processando envio para: " + to);
        console.log("Campos detectados: " + Object.keys(params).join(", "));

        if (!to || !html) {
            throw new Error("Dados obrigatórios ausentes: 'destinatario' ou 'corpoHtml'.");
        }

        // 2. Processamento de Anexos Protegido
        var attachments = [];
        if (params.attachments) {
            var files = [];
            try {
                files = typeof params.attachments === 'string' ? JSON.parse(params.attachments) : params.attachments;
            } catch (e) {
                console.error("Erro no parse dos anexos: " + e.toString());
            }

            if (Array.isArray(files)) {
                files.forEach(function (f) {
                    try {
                        if (f.data && f.data.indexOf(',') > -1) {
                            var base64Data = f.data.split(',')[1];
                            var decoded = Utilities.base64Decode(base64Data);
                            var blob = Utilities.newBlob(decoded, f.type || 'application/octet-stream', f.name || 'documento');
                            attachments.push(blob);
                            console.log("Anexo processado: " + f.name);
                        }
                    } catch (errFile) {
                        console.error("Erro ao processar anexo " + f.name + ": " + errFile.toString());
                    }
                });
            }
        }

        // 3. DISPARO REAL
        GmailApp.sendEmail(to, subject, "Seu leitor não suporta HTML. Por favor, visualize em um cliente moderno.", {
            htmlBody: html,
            name: "ELETRO",
            attachments: attachments
        });

        console.log("Sucesso! E-mail disparado.");
        return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);

    } catch (erro) {
        console.error("FALHA NO SCRIPT: " + erro.toString());
        return ContentService.createTextOutput("Erro: " + erro.toString()).setMimeType(ContentService.MimeType.TEXT);
    }
}

function doGet() {
    return HtmlService.createHtmlOutput("Servidor ELETRO Online.");
}
