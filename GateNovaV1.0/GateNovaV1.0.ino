
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

#define SS_PIN 5
#define RST_PIN 22

#define LED_VERDE 2
#define LED_ROJO 4
#define SERVO_PIN 25

#define BARRERA_CERRADA 0
#define BARRERA_ABIERTA 90

const char* ssid = "INFINITUM11CE";
const char* password = "M@rc3l1n@1";

MFRC522 mfrc522(SS_PIN, RST_PIN);
Servo barrera;

void setup() {
  Serial.begin(115200);

  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_ROJO, OUTPUT);

  digitalWrite(LED_VERDE, LOW);
  digitalWrite(LED_ROJO, LOW);

  barrera.setPeriodHertz(50);
  barrera.attach(SERVO_PIN, 500, 2400);
  barrera.write(BARRERA_CERRADA);

  WiFi.begin(ssid, password);

  Serial.print("Conectando a WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Conectado correctamente");
  Serial.println(WiFi.localIP());

  SPI.begin();
  mfrc522.PCD_Init();

  Serial.println("Escanea una tarjeta RFID");
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  String uid = "";

  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      uid += "0";
    }

    uid += String(mfrc522.uid.uidByte[i], HEX);

    if (i < mfrc522.uid.size - 1) {
      uid += " ";
    }
  }

  uid.toUpperCase();

  Serial.println("UID: " + uid);

  enviarUID(uid);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

void indicarAcceso(bool autorizado) {
  if (autorizado) {
    Serial.println("Abriendo barrera");

    digitalWrite(LED_VERDE, HIGH);
    digitalWrite(LED_ROJO, LOW);

    barrera.write(BARRERA_ABIERTA);
    delay(3000);

    Serial.println("Cerrando barrera");

    barrera.write(BARRERA_CERRADA);
    delay(1000);

    digitalWrite(LED_VERDE, LOW);
  }
  else {
    digitalWrite(LED_VERDE, LOW);
    digitalWrite(LED_ROJO, HIGH);

    barrera.write(BARRERA_CERRADA);
    delay(2000);

    digitalWrite(LED_ROJO, LOW);
  }
}

void enviarUID(String uid) {
  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    http.begin("http://192.168.1.89:8000/api/rfid");
    http.addHeader("Content-Type", "application/json");

    String json = "{\"uid\":\"" + uid + "\",\"access_type\":\"entry\"}";

    int respuesta = http.POST(json);

    Serial.println("Respuesta del servidor:");
    Serial.println(respuesta);

    if (respuesta == 200) {
      String contenido = http.getString();

      Serial.println(contenido);

      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, contenido);

      if (!error) {
        String resultado = doc["access_result"] | "";

        if (resultado == "authorized") {
          Serial.println("ACCESO AUTORIZADO");
          indicarAcceso(true);
        }
        else if (resultado == "denied") {
          Serial.println("ACCESO RECHAZADO");
          indicarAcceso(false);
        }
      }
    }
    else {
      Serial.println("Error al comunicarse con FastAPI");
      barrera.write(BARRERA_CERRADA);
    }

    http.end();
  }
  else {
    Serial.println("WiFi desconectado");
    barrera.write(BARRERA_CERRADA);
  }
}
