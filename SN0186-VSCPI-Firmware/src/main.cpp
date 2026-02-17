/*
 *      ESP32-S3 Weather Station — SEN0186 Parser
 *
 *      Hardware: ESP32-S3-WROOM-1
 *      Weather:  DFRobot SEN0186 via green interface board
 *
 *      Wiring:
 *      Interface Board TX  → GPIO 16 (UART1 RX)  !Use 10kΩ+20kΩ voltage divider!
 *      (5V→3.3V) Interface Board GND → ESP32 GND Interface Board 12V → External 12V
 *      supply ESP32 USB-C → Computer (for Serial Monitor at 115200)
 *
 *      VOLTAGE WARNING: The interface board TX is 5V logic.
 *      ESP32-S3 GPIO pins are 3.3V only and NOT 5V tolerant!
 *      Add a voltage divider: 10kΩ from TX to GPIO16, 20kΩ from GPIO16 to GND.
 *      This gives: 5V × 20/(10+20) = 3.33V ✅
 *
 *      Boris Milev - 2026-02-18
 */

#include "WeatherParser.h"
#include <Arduino.h>


#define WEATHER_RX_PIN 16 // GPIO 16 - connect to interface board TX (via voltage divider!)
#define WEATHER_TX_PIN 17 // not used
#define WEATHER_BAUD 9600 // SEN0186 interface board default baud rate

HardwareSerial WeatherSerial(1); // UART1 - no conflict with USB CDC Serial

void setup() {
  Serial.begin(115200);
  delay(2000);

  WeatherSerial.begin(WEATHER_BAUD, SERIAL_8N1, WEATHER_RX_PIN, WEATHER_TX_PIN);

  Serial.println("\n=================================");
  Serial.println("ESP32-S3 Weather Station");
  Serial.println("=================================");
  Serial.print("UART1 RX: GPIO");
  Serial.println(WEATHER_RX_PIN);
  Serial.print("Baud rate: ");
  Serial.println(WEATHER_BAUD);
  Serial.println("Expected: c000s000g000t086r000p000h53b10020*3E");
  Serial.println("Waiting for weather data...\n");
}

void loop() {
  if (WeatherSerial.available()) {
    String data = WeatherSerial.readStringUntil('\n');
    data.trim();

    if (data.length() > 0) {
      Serial.print("[RAW] ");
      Serial.println(data);

      WeatherData weather = WeatherParser::parse(data);
      WeatherParser::printData(weather);
    }
  }

  delay(100);
}
