
const https = require('https');
const fs = require('fs-extra');

module.exports = {
    downloadKvmEntries: downloadKvmEntries
};

// Pull KVMs
function downloadKvmEntries(options, callback) {
    //Creating final directory
    if (!fs.existsSync(`./kvms/${options.ae}`)) {
        fs.mkdirSync(`./kvms/${options.ae}`, { recursive: true });
    }
    // GET List of KVMs by environment
    get(options, `/v1/o/${options.ao}/e/${options.ae}/keyvaluemaps`, function (kvmsList, error) {
        if (error)
            callback(error);
        
        fs.writeFileSync(`./kvms/kvmsList.json`, JSON.stringify(kvmsList, null, 4));

        // Iterate each kvm
        kvmsList.forEach(kvm => {
            // GET KVM entries
            get(options, `/v1/o/${options.ao}/e/${options.ae}/keyvaluemaps/${kvm}`, function (kvmEntries, error) {
                if (error)
                    callback(error);
                // Flow for encrypted KVMs
                if (kvmEntries.encrypted) {
                    const kvmReaderObject = {
                        name: kvmEntries.name,
                        entry: kvmEntries.entry.map(e => e.name)
                    };
                    let keys = kvmReaderObject.entry;
                    let counter = 0;
                    let e = null;
                    const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

                    if (keys.length > 0) {
                        while (keys.length > 0 && e == null) {
                            const entries = keys.splice(0, 10);
                            let rkvm = { name: kvmReaderObject.name, entry: entries };
                            delay(100);

                            // Pointing request to proxies domain
                            options.ah = `${options.ao}-${options.ae}.apigee.net`;
                            // POST call to kvm-reader proxy to decrypt all the values, 10 by 10
                            post(options, '/kvm-reader', rkvm, (decryptedKvm, error) => {
                                if (error)
                                    callback(error);

                                decryptedKvm.entry.forEach(entry => {
                                    for (let index = 0; index < kvmEntries.entry.length; index++) {
                                        if (kvmEntries.entry[index].name == entry.name) {
                                            kvmEntries.entry[index].value = entry.value;
                                            counter++;
                                            break;
                                        }
                                    }
                                });

                                if (counter == kvmEntries.entry.length) {
                                    // Save the decrypted KVM object in a json file
                                    fs.writeFileSync(`./kvms/${options.ae}/${kvmEntries.name}.json`, JSON.stringify(kvmEntries, null, 4));
                                    callback(null, kvmEntries);
                                }
                            });
                        }
                    } else {
                        fs.writeFileSync(`./kvms/${options.ae}/${kvmEntries.name}.json`, JSON.stringify(kvmEntries, null, 4));
                    }
                } else {
                    // Save the KVM object in a json file
                    fs.writeFileSync(`./kvms/${options.ae}/${kvmEntries.name}.json`, JSON.stringify(kvmEntries, null, 4));
                    callback(null, kvmEntries);
                }

            });
        });
    });
}

function logHttpError(path, verb, error) {
    console.log(error);
    const e = typeof error == "string" ? error : JSON.stringify(error, null, 4);
    console.log('---------------------------- BEGIN ERROR ----------------------------');
    console.log(`path: ${path}`);
    console.log(`verb: ${verb}`);
    console.log(`error: ${e}`);
    console.log('---------------------------- END ERROR ------------------------------');
}

function get(config, path, callback) {
    console.log(`GET ${path}`);
    const options = {
        hostname: config.ah,
        port: 443,
        path: path,
        method: 'GET',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${config.au}:${config.ap}`, 'utf8').toString('base64'),
            'Accept': 'application/json'
        }
    };
    let debug = {
        request: {
            options: options,
            timestamp: new Date()
        },
        response: {}
    };
    const req = https.request(options, res => {
        let data = "";
        debug.response.statusCode = res.statusCode;
        debug.response.headers = res.headers;
        res.on('data', chunk => {
            data += chunk.toString();
        });

        res.on('end', () => {
            debug.response.timestamp = new Date();
            debug.response.content = data;

            let segments = path.split('/');
            let file = segments[segments.length - 1] + '.get.json';


            if (config.debug) {
                if (!fs.existsSync('debug')) {
                    fs.mkdirSync('debug');
                }
                const existentData = fs.existsSync('debug/' + file) ? JSON.parse(fs.readFileSync('debug/' + file, 'utf8')) : [];
                existentData.push(debug);

                fs.writeFileSync('debug/' + file, JSON.stringify(existentData, null, 4), (err) => {
                    if (err) {
                        console.error(`Could not save ${file}`);
                    }
                });
            }
            const obj = JSON.parse(data);
            if (res.statusCode == 200 && callback) {
                callback(obj, null, res);
            } else if (callback) {
                logHttpError(path, 'GET', obj);
                callback(null, obj, res);
            }
        });
    });
    req.on('error', error => {
        logHttpError(path, 'GET', error);
        if (callback) callback(null, error);
    });
    req.end();
}

function post(config, path, data, callback) {
    console.log(`POST ${path}`);
    let payload = typeof data == "string" ? data : JSON.stringify(data, null, 4);
    const options = {
        hostname: config.ah,
        port: config.port,
        path: path,
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${config.au}:${config.ap}`, 'utf8').toString('base64'),
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Content-Length': payload.length
        }
    };
    let debug = {
        request: {
            options: options,
            timestamp: new Date(),
            content: payload
        },
        response: {}
    };
    const req = https.request(options, res => {
        let body = "";
        debug.response.statusCOde = res.statusCode;
        debug.response.headers = res.headers;
        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            debug.response.timestamp = new Date();
            debug.response.content = body;
            let segments = path.split('/');
            let file = segments[segments.length - 1] + '.post.json';
            if (config.debug) {
                const existentData = fs.existsSync('debug/' + file) ? JSON.parse(fs.readFileSync('debug/' + file, 'utf8')) : [];
                if (!fs.existsSync('debug')) {
                    fs.mkdirSync('debug');
                }
                existentData.push(debug);
                fs.writeFileSync('debug/' + file, JSON.stringify(existentData, null, 4), (err) => {
                    if (err) {
                        console.error(`Could not save ${file}`);
                    }
                });
            }
            const obj = JSON.parse(body);
            if (res.statusCode <= 202 && callback) {
                callback(obj, null, res);
            } else if (callback) {
                logHttpError(path, 'POST', obj);
                callback(null, obj, res);
            }
        });
    });

    req.on('error', error => {
        logHttpError(path, 'POST', error);
        if (callback) callback(null, error, null);
    });
    req.write(payload);
    req.end();
}
