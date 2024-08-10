const path = require('path');
const {tests} = require('@iobroker/testing');
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const mock = express();
mock.use(bodyParser.json({extended: true}));
mock.use((req, res, next) => {
    console.log(`@${req.method} ${req.path}`);
    next();
});

// cert is expired but we skip check anyway.
const privateKey = '-----BEGIN RSA PRIVATE KEY-----\r\nMIIEowIBAAKCAQEApiwLPoVRCr+UD5jyPFqQim5aMlRb+6LimwNRMD6A3HrktbTO\r\nJ0rqDMvtmAIyFPpi6VxhABSDBwUWqkVjLlyziHLOuLRUFu3EBGjqSV7kMZ4MUNLo\r\nBbLxr68nsFEOaNqFdkCQlCz51QQnIuDM42kKMh2F/KEfFUWhVl++G0UY1yAMSk4Q\r\nKM1prbagnCIEQ2I9vuyS45EK6AKZklEeP64Qmu0vGlNGZ8uT78bV1xfXANrSPIEq\r\nQvWmj2suj/zxDHrL6P0JxqAnGxp0QsqoGdSd99A5yTXw/u60WbzHvQ/9Gf2pnNqm\r\n3lp6JnQLUau7yJws4NixlK3TUYZlFtPKsMnCjQIDAQABAoIBAAJeQlLDx6HllRCb\r\n12fwynqOlA5/kUgGzD/1TiTn3yJFRhko2H9K3AcOqPYvodMWtm4o+ODtaeihs+79\r\nSiqQ+6YILNYJC+G/xbliXWRqS8pBPF+ygcgDAtrEHkavAQuRgbFrviO+eFkG1B/1\r\nIDZletW4Af7VtQGymlgGyUjONUprjp9KMpOwQv9/g2s6N4k6nwYr5PiF3MZKUqCj\r\n9hrGqhDdmShsK2KmOp3i4qiwb+uhYpgvUGYzHEnlMsRBDJoGp5iDafYf+zSwACX4\r\n6mnK0dF4Ms3Jig/mANhpAMIOjZG7ERsdLoO23JTF16cag9glH701xmgdqLbp803H\r\noewpr2kCgYEA1eRCQm9ivVj9DeGJ021QD5pCiNZdbw4wHgRuGXxh/BXEoGusr8W7\r\ng3FJIHgykITz889G7Lo3iDAEkQ6XhdOy787L2qOzmIHKC9gzcxWlsSVnYAxkg3wz\r\njYlkag+oruj1ged3bqATIogaRvFr+nKKqIkJGvzvuKShe/NHVTJh7TcCgYEAxuLO\r\ncalKJHK8EA8dMHCdWTtvnn5ySzoARzaQlmBp/9FyjiDbRC6ApHiY99EqLcwgXbjm\r\nwcdemfxSJrNUvSdxWd0RQnL5WT38TqjKoVymiPlTZYcAnM7o/q7yoejLuY6YpTEy\r\niJSDj6ISYxa/OKiUA/o0jvK48WekKnI63JuREFsCgYB2MAOg3BVuVR63LdnPlwZ3\r\nKKD9JZ5JQEi8PWxs7rrh5VFZ50VrdtIvRkjHBUPDcYOvQ+iH5DnNKeNMGAkH7Lti\r\nIR2peW1Cpuzy8Is1W0/L+8QMYaykrtt5qOJwbKijxZvrJPBsk00fdp82di5ZHDOb\r\n/uSmIf+AQo/sgrf2zrknrwKBgFeIgyvrQkKAbNz0ifhD2Dzpt9qd9Fe/k1fEYCaP\r\nEJgS6sQ7GcYMYXoByfFoEZROfwBA3O70fGJxdwapbuZBcdYHQg1o5O2uJlnIWEZk\r\nrLckZNwOauqY9lsBTLCN8PweEnjCCmeqVazlvAn4fPjG2T5W5ML1eQhmgQ5dcCKg\r\nJVx5AoGBAK9a6iiyp9i9EbVTBnIo56kfJDNR+f4niu9rTUo4eSbSDNboZjDXXZqc\r\nqkTYoRmIHMeeeGbgWXJxra83TqAGezy3vuHchNlxdlMsTYyIMuV2nx39+ooZ6IXu\r\nlxu0fpjFFlR0zM1u5cOohdZK2zl+LgIDdpd7u3FhXgXLs1jQM0kd\r\n-----END RSA PRIVATE KEY-----\r\n';
const certificate = '-----BEGIN CERTIFICATE-----\r\nMIIDmjCCAoKgAwIBAgIJArlH3TwvJZIqMA0GCSqGSIb3DQEBCwUAMGkxFDASBgNV\r\nBAMTC2V4YW1wbGUub3JnMQswCQYDVQQGEwJVUzERMA8GA1UECBMIVmlyZ2luaWEx\r\nEzARBgNVBAcTCkJsYWNrc2J1cmcxDTALBgNVBAoTBFRlc3QxDTALBgNVBAsTBFRl\r\nc3QwHhcNMjEwOTI2MTMwMzIwWhcNMjIwOTI2MTMwMzIwWjBpMRQwEgYDVQQDEwtl\r\neGFtcGxlLm9yZzELMAkGA1UEBhMCVVMxETAPBgNVBAgTCFZpcmdpbmlhMRMwEQYD\r\nVQQHEwpCbGFja3NidXJnMQ0wCwYDVQQKEwRUZXN0MQ0wCwYDVQQLEwRUZXN0MIIB\r\nIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApiwLPoVRCr+UD5jyPFqQim5a\r\nMlRb+6LimwNRMD6A3HrktbTOJ0rqDMvtmAIyFPpi6VxhABSDBwUWqkVjLlyziHLO\r\nuLRUFu3EBGjqSV7kMZ4MUNLoBbLxr68nsFEOaNqFdkCQlCz51QQnIuDM42kKMh2F\r\n/KEfFUWhVl++G0UY1yAMSk4QKM1prbagnCIEQ2I9vuyS45EK6AKZklEeP64Qmu0v\r\nGlNGZ8uT78bV1xfXANrSPIEqQvWmj2suj/zxDHrL6P0JxqAnGxp0QsqoGdSd99A5\r\nyTXw/u60WbzHvQ/9Gf2pnNqm3lp6JnQLUau7yJws4NixlK3TUYZlFtPKsMnCjQID\r\nAQABo0UwQzAMBgNVHRMEBTADAQH/MAsGA1UdDwQEAwIC9DAmBgNVHREEHzAdhhto\r\ndHRwOi8vZXhhbXBsZS5vcmcvd2ViaWQjbWUwDQYJKoZIhvcNAQELBQADggEBAHjC\r\nOmE9UO/ONDDQrpe1BjF1ZHU5keQJehZbzTL5DLmxSHo38atxD7hXFqGuhX+o4Qwc\r\n3TNN4zpCAhx3W6QiquKleJPn/DkwSSkR7J7UZAEwro0tnTbfbwCIkXNC+1fo4urg\r\naNEIPbbYCMiuQIWfjOMnYuMyd5kqZF7vbhm071z+ZOLNDh+vPBuQN0m4dxZ9Aq23\r\nDpKIFWeA5cMEXZ/CipfvKlu2ZjTxrWiTYC04nn4VE5zTPxparI4MzXnk3psFHCFm\r\nv8uaRhKix2tG7IjYZGSgSGeoC5eK4/wfWswAfTjZDMaO64OuwW7teJIeroU5wl0X\r\nJU12EubECDTMzx1DJdM=\r\n-----END CERTIFICATE-----\r\n';

const httpsServer = https.createServer({key: privateKey, cert: certificate}, mock);

// We most likely do not need this anymore. But we keep it for now.
const overwriteAndTest = harness => {
    harness.objects.getObject('system.adapter.bshb.0', (err, obj) => {
        if (err) {
            console.log(err);
        }
        obj.native.systemPassword = 'Test';
        obj.native.identifier = 'Test';
        obj.native.pairingDelay = 1000;
        obj.native.rateLimit = 1000;
        obj.native.host = '127.0.0.1';
        obj.native.mac = 'xx-xx-xx-xx-xx';
        obj.native.certsPath = '/test';
        harness.objects.setObject(obj._id, obj);
    });
};

mock.get('/smarthome/rooms', (req, res) => {
    res.json([
        {
            '@type': 'room',
            'id': 'hz_1',
            'iconId': 'icon_room_living_room',
            'name': 'Wohnzimmer',
        },
        {
            '@type': 'room',
            'id': 'hz_2',
            'iconId': 'icon_room_bedroom',
            'name': 'Schlafzimmer',
        },
        {
            '@type': 'room',
            'id': 'hz_3',
            'iconId': 'icon_room_hallway',
            'name': 'Flur',
        }
    ]);
});

mock.get('/smarthome/rooms/hz_2', (req, res) => {
    res.json(
        {
            '@type': 'room',
            'id': 'hz_2',
            'iconId': 'icon_room_bedroom',
            'name': 'Schlafzimmer',
        }
    );
});

mock.get('/smarthome/scenarios', (req, res) => {
    res.json([
        {
            '@type': 'scenario',
            'id': 'f38770c1-62d7-4a71-8cef-51d1241e651e',
            'name': 'Strom aus',
            'iconId': 'icon_scenario_shutter_down',
            'actions': [
                {
                    'deviceId': 'hdm:HomeMaticIP:3014F711A0000496D858A9D6',
                    'deviceServiceId': 'PowerSwitch',
                    'targetState': {
                        '@type': 'powerSwitchState',
                        'switchState': 'OFF'
                    }
                }
            ]
        }
    ]);
});

mock.get('/smarthome/automation/rules', (req, res) => {
    res.json([
        {
            '@type': 'automationRule',
            'id': '69ac04ef-bd77-41ea-968b-a99c690ddbc7',
            'name': 'demo',
            'enabled': false,
            'automationTriggers': [
                {
                    'type': 'WallThermostatHumidityThresholdTrigger',
                    'configuration': '{"comparisonMode":"GREATER_THAN","deviceId":"hdm:ZigBee:0000000000000000","threshold":100}'
                },
                {
                    'type': 'RoomClimateControlMeasuredTemperatureTrigger',
                    'configuration': '{"threshold":16.5,"comparisonMode":"GREATER_THAN","deviceId":"roomClimateControl_hz_2"}'
                }
            ],
            'automationConditions': [
                {
                    'type': 'ShutterContactCondition',
                    'configuration': '{"conditionState":"OPEN","shutterContactId":"hdm:HomeMaticIP:0000000000000000000000000"}'
                },
                {
                    'type': 'AstroTimeCondition',
                    'configuration': '{"astroTimeConditionType":"DAYTIME","startOffsetInMinutes":0}'
                }
            ],
            'automationActions': [
                {
                    'type': 'CustomPushNotificationAction',
                    'delayInSeconds': 0,
                    'configuration': '{"message":"Hello custom notifications"}'
                }
            ],
            'conditionLogicalOp': 'AND'
        }
    ]);
});

mock.get('/smarthome/messages', (req, res) => {
    res.json([
        {
            '@type': 'message',
            'id': '00006590-0000-0000-0000-300000600000',
            'messageCode': {
                'name': 'UPDATE_AVAILABLE',
                'category': 'SW_UPDATE'
            },
            'sourceType': 'CONTROLLER',
            'sourceId': 'com/bosch/sh/controller/system/swupdate',
            'timestamp': 1632317629576,
            'flags': [
                'STICKY',
                'USER_ACTION_REQUIRED'
            ],
            'arguments': {
                'version': '10.2.2167-20856-10.2.2164-20551'
            }
        }
    ]);
});

mock.get('/smarthome/doors-windows/openwindows', (req, res) => {
    res.json({
        'allDoors': [
            {
                'name': 'Eingangstür',
                'roomName': 'Flur'
            }
        ],
        'openDoors': [],
        'unknownDoors': [],
        'allWindows': [
            {
                'name': 'Fensterkontakt',
                'roomName': 'Schlafzimmer'
            },
            {
                'name': 'Fenster',
                'roomName': 'Wohnzimmer'
            }
        ],
        'openWindows': [
            {
                'name': 'Fensterkontakt',
                'roomName': 'Schlafzimmer'
            }
        ],
        'unknownWindows': [],
        'allOthers': [],
        'openOthers': [],
        'unknownOthers': []
    });
});

mock.get('/smarthome/devices', (req, res) => {
    res.json([
        {
            '@type': 'device',
            'rootDeviceId': '00-00-00-00-00-00',
            'id': 'hdm:ZigBee:0000000000000000',
            'deviceServiceIds': [
                'CommunicationQuality',
                'BatteryLevel',
                'MultiswitchDebug',
                'MultiswitchConfiguration',
                'TemperatureLevel'
            ],
            'manufacturer': 'BOSCH',
            'roomId': 'hz_2',
            'deviceModel': 'MULTISWITCH',
            'serial': '0000000000000000',
            'profile': 'GENERIC',
            'name': 'Twist',
            'status': 'AVAILABLE',
            'childDeviceIds': []
        },
        {
            '@type': 'device',
            'rootDeviceId': '00-00-00-00-00-00',
            'id': 'roomClimateControl_hz_1',
            'deviceServiceIds': [
                'ThermostatSupportedControlMode',
                'TemperatureLevelConfiguration',
                'RoomClimateControl',
                'TemperatureLevel'
            ],
            'manufacturer': 'BOSCH',
            'roomId': 'hz_1',
            'deviceModel': 'ROOM_CLIMATE_CONTROL',
            'serial': 'roomClimateControl_hz_1',
            'iconId': 'icon_room_bathroom_rcc',
            'name': '-RoomClimateControl-',
            'status': 'AVAILABLE',
            'childDeviceIds': [
                'hdm:HomeMaticIP:000000000000000000000000'
            ]
        },
    ]);
});

mock.get('/smarthome/devices/hdm:ZigBee:xxx', (req, res) => {
    res.json(
        {
            '@type': 'device',
            'rootDeviceId': '00-00-00-00-00-00',
            'id': 'hdm:ZigBee:xxx',
            'deviceServiceIds': [
                'CommunicationQuality',
                'BatteryLevel',
                'MultiswitchDebug',
                'MultiswitchConfiguration',
                'TemperatureLevel'
            ],
            'manufacturer': 'BOSCH',
            'roomId': 'hz_2',
            'deviceModel': 'MULTISWITCH',
            'serial': '0000000000000000',
            'profile': 'GENERIC',
            'name': 'Bewegungsmelder',
            'status': 'AVAILABLE',
            'childDeviceIds': []
        }
    );
});

mock.get('/smarthome/services', (req, res) => {
    res.json([
        {
            '@type': 'DeviceServiceData',
            'id': 'SoftwareUpdate',
            'deviceId': '00-00-00-00-00-00',
            'state': {
                '@type': 'softwareUpdateState',
                'swUpdateState': 'UPDATE_AVAILABLE',
                'swUpdateLastResult': 'UPDATE_SUCCESS',
                'swUpdateAvailableVersion': '10.2.2167-20856-10.2.2164-20551',
                'swInstalledVersion': '10.2.2164-20551',
                'swActivationDate': {
                    '@type': 'softwareActivationDate',
                    'activationDate': '2021-09-29T13:33:48.977Z',
                    'timeout': 604800000,
                    'latestActivationDate': '2021-09-29T13:33:48.977Z',
                    'updateReceived': '2021-09-22T13:33:48.977Z'
                }
            },
            'path': '/system/services/SoftwareUpdate'
        },
        {
            '@type': 'DeviceServiceData',
            'id': 'TemperatureLevel',
            'deviceId': 'roomClimateControl_hz_1',
            'state': {
                '@type': 'temperatureLevelState',
                'temperature': 20.0
            },
            'path': '/devices/roomClimateControl_hz_1/services/TemperatureLevel'
        },
    ]);
});

mock.post('/remote/json-rpc', (req, res) => {
    if (req.body.method === 'RE/subscribe') {
        res.json([
            {
                'result': 'ejf4hkl0l-55',
                'jsonrpc': '2.0'
            }
        ]);
    }
    if (req.body.method === 'RE/longPoll') {
        setTimeout(() => {
            res.json(
                {
                    'result': [
                        {
                            '@type': 'DeviceServiceData',
                            'id': 'TemperatureLevel',
                            'deviceId': 'roomClimateControl_hz_1',
                            'state': {
                                '@type': 'temperatureLevelState',
                                'temperature': 21.0
                            },
                            'path': '/devices/roomClimateControl_hz_1/services/TemperatureLevel'
                        },
                    ],
                    'jsonrpc': '2.0'
                }
            );
        }, 2000);
    }
});

mock.get('/smarthome/airquality/airpurityguardian', (req, res) => {
    res.json([
        {
            '@type': 'airPurityGuardian',
            'id': 'airPurityGuardian_hz_2',
            'name': 'Schlafzimmer',
            'enabled': false,
            'lightActuators': [],
            'staticSensitivityLevels': {
                'high': [
                    1000,
                    1500
                ],
                'medium': [
                    1500,
                    2000
                ],
                'low': [
                    2000,
                    2500
                ]
            },
            'configuration': {
                'sensitivity': 'MEDIUM',
                'operatingHours': {
                    'startTime': '08:00',
                    'endTime': '22:00',
                    'alwaysOn': true
                },
                'actuators': {
                    'pushNotificationEnabled': true,
                    'red': {
                        'mode': 'BLINKING',
                        'lights': []
                    },
                    'yellow': {
                        'lights': []
                    },
                    'green': {
                        'lights': []
                    }
                }
            }
        }
    ]);
});

mock.get('/smarthome/motionlights', (req, res) => {
    res.json([
        {
            '@type': 'motionlight',
            'id': 'hdm:ZigBee:xxx',
            'enabled': false,
            'brightness': 90,
            'darknessThresholdLux': 30,
            'lightsOffDelay': 5,
            'illuminanceLux': 9,
            'lightIds': [
                'hdm:PhilipsHueBridge:HueLight_test'
            ],
            'motionDetectorId': 'hdm:ZigBee:xxx'
        }
    ]);
});

mock.get('/smarthome/wateralarm', (req, res) => {
    res.json({
        '@type': 'waterAlarmSystemState',
        'available': false,
        'visualActuatorsAvailable': false,
        'videoActuatorsAvailable': true,
        'state': 'ALARM_OFF',
        'deleted': false
    });
});

mock.get('/smarthome/intrusion/states/system', (req, res) => {
    res.json({
        '@type': 'systemState',
        'systemAvailability': {
            '@type': 'systemAvailabilityState',
            'available': true,
            'deleted': false
        },
        'armingState': {
            '@type': 'armingState',
            'state': 'SYSTEM_DISARMED',
            'deleted': false
        },
        'alarmState': {
            '@type': 'alarmState',
            'value': 'ALARM_OFF',
            'incidents': [],
            'deleted': false
        },
        'activeConfigurationProfile': {
            '@type': 'activeConfigurationProfile',
            'profileId': '1',
            'deleted': false
        },
        'securityGapState': {
            '@type': 'securityGapState',
            'securityGaps': [],
            'deleted': false
        },
        'deleted': false
    });
});

mock.get('/smarthome/devices/roomClimateControl_hz_1/services/RoomClimateControl', (req, res) => {
    res.json({
        '@type': 'DeviceServiceData',
        'id': 'RoomClimateControl',
        'deviceId': 'roomClimateControl_hz_1',
        'state': {
            '@type': 'climateControlState',
            'operationMode': 'AUTOMATIC',
            'setpointTemperature': 16.0,
            'setpointTemperatureForLevelEco': 16.0,
            'setpointTemperatureForLevelComfort': 18.0,
            'schedule': {
                'profiles': [
                    {
                        'day': 'MONDAY',
                        'switchPoints': [
                            {
                                'startTimeMinutes': 0,
                                'value': {
                                    '@type': 'temperatureLevelSwitchPointValue',
                                    'temperatureLevel': 'ECO'
                                }
                            },
                            {
                                'startTimeMinutes': 300,
                                'value': {
                                    '@type': 'temperatureLevelSwitchPointValue',
                                    'temperatureLevel': 'COMFORT'
                                }
                            },
                            {
                                'startTimeMinutes': 480,
                                'value': {
                                    '@type': 'temperatureLevelSwitchPointValue',
                                    'temperatureLevel': 'ECO'
                                }
                            }
                        ]
                    },
                ]
            },
            'ventilationMode': false,
            'low': false,
            'boostMode': false,
            'summerMode': false,
            'supportsBoostMode': true,
            'showSetpointTemperature': false,
            'roomControlMode': 'HEATING'
        },
        'operations': [
            'incrementSetpointTemperature',
            'decrementSetpointTemperature'
        ],
        'path': '/devices/roomClimateControl_hz_1/services/RoomClimateControl'
    });
});

mock.get('/smarthome/climate/schedule/roomClimateControl_hz_1/HEATING', (req, res) => {
    res.json({
        'activeScheduleId': '6cf50f13-37df-4f18-9c21-a5a6993f8165',
        'scheduleData': [
            {
                '@type': 'scheduleData',
                'id': '79098d61-d9d0-42ba-aa88-13b5c7361d10',
                'profiles': [
                    {
                        'day': 'MONDAY',
                        'switchPoints': [
                            {
                                'startTimeMinutes': 0,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 17.0
                                }
                            },
                            {
                                'startTimeMinutes': 360,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 21.0
                                }
                            },
                            {
                                'startTimeMinutes': 480,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 17.0
                                }
                            },
                            {
                                'startTimeMinutes': 960,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 21.0
                                }
                            },
                            {
                                'startTimeMinutes': 1200,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 17.0
                                }
                            }
                        ]
                    },
                ],
                'attributeExtensionMap': {
                    'ScheduleType': 'SYSTEM',
                    'ClimateRoomControlMode': 'HEATING'
                }
            },
            {
                '@type': 'scheduleData',
                'id': '6cf50f13-37df-4f18-9c21-a5a6993f8165',
                'profiles': [
                    {
                        'day': 'MONDAY',
                        'switchPoints': [
                            {
                                'startTimeMinutes': 0,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 16.0
                                }
                            },
                            {
                                'startTimeMinutes': 300,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 18.0
                                }
                            },
                            {
                                'startTimeMinutes': 480,
                                'value': {
                                    '@type': 'temperatureSwitchPointValue',
                                    'temperature': 16.0
                                }
                            }
                        ]
                    },
                ],
                'attributeExtensionMap': {
                    'ScheduleType': 'CUSTOM',
                    'ClimateRoomControlMode': 'HEATING'
                }
            }
        ],
        'hasFreeScheduleSlots': true
    });
});

mock.get('/smarthome/userdefinedstates', (req, res) => {
    res.json([
        {
            'deleted': false,
            '@type': 'userDefinedState',
            'name': 'Test123',
            'id': 'd97014f1-2eeb-41ca-bd91-39b0f64e7908',
            'state': true
        }
    ]);
});

httpsServer.listen(8444, () => {
});

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    allowedExitCodes: [ 0 ],
    waitBeforeStartupSuccess: 2000,
    defineAdditionalTests({suite}) {
        suite('Test sendTod()', getHarness => {
            it('Generic test', () => new Promise(async resolve => {
                // Create a fresh harness instance each test!
                console.log('Creating harness');
                const harness = getHarness();

                // This does not work. See: https://github.com/ioBroker/testing/issues/218
                await harness.changeAdapterConfig('bshb', {
                    native: {
                        systemPassword: 'Test',
                        identifier: 'Test',
                        pairingDelay: 1000,
                        rateLimit: 1000,
                        host: '127.0.0.1',
                        skipServerCertificateCheck: true,
                        mac: 'xx-xx-xx-xx-xx',
                        certsPath: '/test'
                    }
                });
                // In case we face issues with changeAdapterConfig again, we can use the overwrite function.
                // overwriteAndTest(harness);


                // Start the adapter and wait until it has started
                await harness.startAdapterAndWait();

                // Perform the actual test:
                harness.on('stateChange', (id, state) => {
                    console.log('Changing: ' + id);
                    if (id.startsWith('bshb.0.roomClimateControl_hz_1.TemperatureLevel.temperature') && state && state.val === 21) {
                        resolve(undefined);
                    }
                });
            })).timeout(10000);
        })
    }
});
