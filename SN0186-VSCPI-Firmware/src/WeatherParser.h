#ifndef WEATHER_PARSER_H
#define WEATHER_PARSER_H

#include <Arduino.h>

struct WeatherData {
  // Raw values (as received)
  int windDirection; // 0-360 degrees
  int windSpeedAvg;  // mph
  int windGust;      // mph (max over 5 min)
  int temperature;   // Fahrenheit (raw value)
  int rainfall1h;    // 0.01 inches
  int rainfall24h;   // 0.01 inches
  int humidity;      // percentage
  int pressure;      // 0.1 mbar

  // Converted values (for easy use)
  float tempF;           // Fahrenheit
  float tempC;           // Celsius
  float windSpeedMPH;    // Miles per hour
  float windSpeedMS;     // Meters per second
  float windGustMPH;     // Miles per hour
  float windGustMS;      // Meters per second
  float rainfallInch1h;  // Inches (last hour)
  float rainfallMM1h;    // Millimeters (last hour)
  float rainfallInch24h; // Inches (last 24h)
  float rainfallMM24h;   // Millimeters (last 24h)
  float humidityPercent; // Percentage
  float pressureMbar;    // Millibars
  float pressureInHg;    // Inches of Mercury

  // Status flags
  bool isValid;       // Overall data validity
  bool rainfallValid; // Rain sensor working (false if 453 error)
  String checksum;    // Checksum from packet
};

class WeatherParser {
public:
  // Parse the weather station string
  // Format: c000s000g000t075r453p453h45b09830*3A
  static WeatherData parse(String data);

  // Helper to extract integer from substring
  static int extractInt(String data, int start, int length);

  // Validate checksum (TODO)
  static bool validateChecksum(String data);

  // Pretty print weather data
  static void printData(WeatherData &weather);
};

#endif
