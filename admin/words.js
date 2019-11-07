/*global systemDictionary:true */
"use strict";

systemDictionary = {
	"host": {
		"en": "Bosch Smart Home Controller IP address",
		"de": "Bosch Smart Home Controller IP-Adresse",
		"ru": "IP-адрес Bosch Smart Home Controller",
		"pt": "Endereço IP do Bosch Smart Home Controller",
		"nl": "IP-adres van de Bosch Smart Home Controller",
		"fr": "Adresse IP du Bosch Smart Home Controller",
		"it": "Indirizzo IP del Bosch Smart Home Controller",
		"es": "Bosch Smart Home Controller Dirección IP",
		"pl": "Adres IP Bosch Smart Home Controller",
		"zh-cn": "博世智能家居控制器IP地址"
	},
	"mac": {
		"en": "Bosch Smart Home Controller Mac address",
		"de": "Bosch Smart Home Controller Mac-Adresse",
		"ru": "Мак-адрес Bosch Smart Home Controller",
		"pt": "Endereço Mac da Bosch Smart Home Controller",
		"nl": "Mac-adres van Bosch Smart Home Controller",
		"fr": "Adresse Mac Bosch Smart Home Controller",
		"it": "Indirizzo Mac del Bosch Smart Home Controller",
		"es": "Bosch Smart Home Controller Dirección Mac",
		"pl": "Adres Mac Bosch Smart Home Controller",
		"zh-cn": "博世智能家居控制器Mac地址"
	},
	"mac-detail": {
		"en": "In format: xx-xx-xx-xx-xx-xx",
		"de": "Im Format: xx-xx-xx-xx-xx-xx",
		"ru": "В формате: хх-хх-хх-хх-хх-хх",
		"pt": "No formato: xx-xx-xx-xx-xx-xx",
		"nl": "In formaat: xx-xx-xx-xx-xx-xx",
		"fr": "Au format: xx-xx-xx-xx-xx-xx",
		"it": "Nel formato: xx-xx-xx-xx-xx-xx",
		"es": "En formato: xx-xx-xx-xx-xx-xx",
		"pl": "W formacie: xx-xx-xx-xx-xx-xx",
		"zh-cn": "格式：xx-xx-xx-xx-xx-xx"
	},
	"identifier": {
		"en": "Unique identifier of created client",
		"de": "Eindeutige Kennung des erstellten Clients",
		"ru": "Уникальный идентификатор созданного клиента",
		"pt": "Identificador único do cliente criado",
		"nl": "Unieke identificatie van de aangemaakte klant",
		"fr": "Identificateur unique du client créé",
		"it": "Identificatore univoco del cliente creato",
		"es": "Identificador único del cliente creado",
		"pl": "Unikalny identyfikator utworzonego klienta",
		"zh-cn": "创建的客户端的唯一标识符"
	},
	"identifier-detail": {
		"en": "uuidv4 is recommended",
		"de": "uuidv4 wird empfohlen",
		"ru": "рекомендуется uuidv4",
		"pt": "uuidv4 é recomendado",
		"nl": "uuidv4 is recommended",
		"fr": "uuidv4 est recommandé",
		"it": "uuidv4 è raccomandato",
		"es": "Se recomienda uuidv4",
		"pl": "Zalecany jest uuidv4",
		"zh-cn": "建议使用uuidv4"
	},
	"systemPassword": {
		"en": "Bosch Smart Home Controller system password",
		"de": "Bosch Smart Home Controller Systempassword",
		"ru": "системный пароль Bosch Smart Home Controller",
		"pt": "senha do sistema da Bosch Smart Home Controller",
		"nl": "Wachtwoord voor het systeem van Bosch Smart Home Controller",
		"fr": "Mot de passe système Bosch Smart Home Controller",
		"it": "Password di sistema del Bosch Smart Home Controller",
		"es": "Bosch Smart Home Controller Contraseña del sistema",
		"pl": "Hasło systemowe Bosch Smart Home Controller",
		"zh-cn": "博世智能家居控制器系统密码"
	},
	"systemPassword-detail": {
		"en": "Can be removed after pairing",
		"de": "Kann nach dem Koppeln entfernt werden",
		"ru": "Может быть удален после сопряжения",
		"pt": "Pode ser removido após o emparelhamento",
		"nl": "Kan na het koppelen worden verwijderd",
		"fr": "Peut être retiré après l'appairage",
		"it": "Può essere rimosso dopo l'accoppiamento",
		"es": "Se puede quitar después del emparejamiento",
		"pl": "Może być usunięty po sparowaniu.",
		"zh-cn": "配对后即可移除"
	},
	"certsPath": {
		"en": "Client certificate directory",
		"de": "Client-Zertifikatsverzeichnis",
		"ru": "Каталог клиентских сертификатов",
		"pt": "Diretório de certificados de cliente",
		"nl": "Klant certificaat directory",
		"fr": "Répertoire des certificats clients",
		"it": "Elenco dei certificati dei clienti",
		"es": "Directorio de certificados de clientes",
		"pl": "Katalog certyfikatów klientów",
		"zh-cn": "客户端证书目录"
	},
	"certsPath-detail": {
		"en": "Absolute path with corresponding access rights. E.g. /home/iobroker/certs",
		"de": "Absoluter Pfad mit entsprechenden Zugriffsrechten. Z.B. /home/iobroker/certs",
		"ru": "Абсолютный путь с соответствующими правами доступа. Например, /home/iobroker/certs",
		"pt": "Caminho absoluto com direitos de acesso correspondentes. Por exemplo, /home/iobroker/certs",
		"nl": "Absoluut pad met bijbehorende toegangsrechten. Bijvoorbeeld /home/iobroker/certs",
		"fr": "Chemin absolu avec les droits d'accès correspondants. p. ex. /home/iobroker/certs",
		"it": "Percorso assoluto con i relativi diritti di accesso. Ad esempio /home/iobroker/certs",
		"es": "Trayectoria absoluta con los correspondientes derechos de acceso. Por ejemplo /home/iobroker/certs",
		"pl": "Ścieżka bezwzględna z odpowiednimi prawami dostępu. Np. /home/iobroker/certs",
		"zh-cn": "具有相应访问权限的绝对路径  例如 /home/iobroker/certs"
	},
	"pairingDelay": {
		"en": "Delay during pairing attempts in ms",
		"de": "Verzögerung bei Kopplungsversuchen in ms",
		"ru": "Задержка при попытках сопряжения в мс",
		"pt": "Atraso durante as tentativas de emparelhamento em ms",
		"nl": "Vertraging tijdens koppelingspogingen in ms",
		"fr": "Délai pendant les tentatives d'appairage en ms",
		"it": "Ritardo durante i tentativi di accoppiamento in ms",
		"es": "Retardo durante los intentos de emparejamiento en ms",
		"pl": "Opóźnienie podczas prób parowania w ms",
		"zh-cn": "配对尝试期间的延迟（毫秒"
	},
	"pairingDelay-detail": {
		"en": "Time waiting during pairing process attempts",
		"de": "Wartezeit während des Kopplungsprozesses",
		"ru": "Время ожидания во время попыток сопряжения",
		"pt": "Tempo de espera durante as tentativas do processo de emparelhamento",
		"nl": "Tijd die wacht tijdens de koppelingspogingen",
		"fr": "Temps d'attente pendant les tentatives de pairage",
		"it": "Tempo di attesa durante i tentativi del processo di accoppiamento",
		"es": "Tiempo de espera durante los intentos de emparejamiento",
		"pl": "Czas oczekiwania podczas prób parowania",
		"zh-cn": "配对过程中的等待时间"
	},
};