const path = require('path');
const {tests} = require('@iobroker/testing');
const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');
const mock = express();
mock.use(bodyParser.json({extended: true}));

const fs = require('fs');
const os = require('os');

// We do not have a Bosch cert but we can disable certificate verification and fake one. This is ok for tests.
// This is a bit hacky but whatever...
const testDir = path.join(os.tmpdir(), 'test-iobroker.bshb');
const certDisableFile = testDir + '/node_modules/bosch-smart-home-bridge/dist/api/abstract-bshc-client.js';

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

httpsServer.listen(8444, () => {
});

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    allowedExitCodes: [0],
    waitBeforeStartupSuccess: 2000,
    defineAdditionalTests(getHarness) {
        describe('Test sendTo()', () => {
            before(() => new Promise(async resolve => {
                console.log('Edit file to disable certificate verification: ' + certDisableFile);

                fs.readFile(certDisableFile, 'utf8', function (err, data) {
                    if (err) {
                        return console.log(err);
                    }
                    const result = data.replace(/requestOptions.rejectUnauthorized = true;/g, 'requestOptions.rejectUnauthorized = false;');

                    fs.writeFile(certDisableFile, result, 'utf8', function (err) {
                        if (err) return console.log(err);
                    });
                });

                resolve(undefined);
            }));
            it('Should work', () => new Promise(async resolve => {
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
        });
    }
});
