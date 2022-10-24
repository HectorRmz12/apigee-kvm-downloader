
const https = require('https');
const fs = require('fs-extra');

module.exports = {
    uploadKvmList: uploadKvmList,
    uploadKvmEntries: uploadKvmEntries,
    deleteKvmEntries: deleteKvmEntries
};

// Push KVMs
function uploadKvmList(options, callback) {
    let file = fs.readFileSync('kvms/kvmsList.json');
    const kvmsList = JSON.parse(file.toString());
    const noSandbox = kvmsList.filter(kvm => !kvm.toString().toLowerCase().includes('sandbox'));

    noSandbox.forEach(kvm => {
        if (kvm) {
            file = fs.readFileSync(`kvms/${options.ae}/${kvm}.json`);
            const kvmDefinition = JSON.parse(file.toString());
            const kvmPayload = { name: kvmDefinition.name, encrypted: kvmDefinition.encrypted };
            // POST - Push kvm to org
            post(options, `/v1/organizations/${options.ao}/environments/${options.ae}/keyvaluemaps`, kvmPayload, (data, error) => {
                if (error)
                    callback(error);

                callback(null, data);
            });
        }
    });
}

// Push KVM Entries
function uploadKvmEntries(options, callback) {
    let file = fs.readFileSync('kvms/kvmsList.json');
    const kvmsList = JSON.parse(file.toString());
    const noSandbox = kvmsList.filter(kvm => !kvm.toString().toLowerCase().includes('sandbox'));
    let counter = 0;

    let promise = Promise.resolve();
    noSandbox.forEach(function (kvm) {
        promise = promise
            .then(() => {
                return new Promise((resolve) => {
                    setTimeout(function () {
                        if (kvm) {
                            file = fs.readFileSync(`kvms/${options.ae}/${kvm}.json`);
                            const kvmDefinition = JSON.parse(file.toString());
                            counter += kvmDefinition.entry.length;

                            for (let index = 0; index < kvmDefinition.entry.length; index++) {
                                const entry = kvmDefinition.entry[index];
                                const kvmPayload = { name: entry.name, value: entry.value };
                                // POST - Push kvm to org
                                console.log('***************');
                                console.log('Calling post for: ' + kvm + ' and entry: ' + kvmPayload.name);
                                post(options, `/v1/organizations/${options.ao}/environments/${options.ae}/keyvaluemaps/${kvmDefinition.name}/entries`, kvmPayload, (data, error) => {
                                    if (error)
                                        callback(error);
                
                                    callback(null, data);
                                });
                            }
                            // kvmDefinition.entry.forEach(entry => {
                                
                            // });
                        }
                        resolve('Done');
                    }, 1000);
                })
            })

    });


    // noSandbox.forEach(async kvm => {
        
    // });
    console.log(counter);
}


// Pull KVMs
function deleteKvmEntries(options, callback) {
    let file = fs.readFileSync('kvms/kvmsList.json');
    const kvmsList = JSON.parse(file.toString());
    const sandboxKvms = kvmsList.filter(kvm => kvm.toString().toLowerCase().includes('sandbox'));

    sandboxKvms.forEach((kvm, index) => {
        if (kvm) {
            // DELETE - Push kvm to org
            deleted(options, `/v1/organizations/${options.ao}/environments/${options.ae}/keyvaluemaps/${kvm}`, (data, error) => {
                if (error)
                    callback(error);

                callback(null, data);
            });
        }
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

function post(config, path, data, callback) {
    // Return new promise
    return new Promise(function (resolve, reject) {
        // Do async job
        setTimeout(() => {
            console.log(`POST ${path}`);
            let payload = typeof data == "string" ? data : JSON.stringify(data, null, 4);
            const authHeader = config.token ? `Bearer ${config.token}` : 'Basic ' + Buffer.from(`${config.au}:${config.ap}`, 'utf8').toString('base64');
            const options = {
                hostname: config.ah,
                port: config.port,
                path: path,
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
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
                debug.response.statusCode = res.statusCode;
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
                    console.log(res.statusCode);
                    console.log(res.statusMessage);
                    console.log(body);
                    const obj = JSON.parse(body);
                    if (res.statusCode <= 202) {
                        resolve(obj);
                        //callback(obj, null, res);
                    } else {
                        logHttpError(path, 'POST', obj);
                        reject(obj);

                        //callback(null, obj, res);
                    }
                });
            });

            req.on('error', error => {
                logHttpError(path, 'POST', error);
                // if (callback) callback(null, error, null);
                reject(error);
            });
            req.write(payload);
            req.end();
        }, 2000);

    });

}

function deleted(config, path, callback) {
    console.log(`DELETE ${path}`);
    const authHeader = config.token ? `Bearer ${config.token}` : 'Basic ' + Buffer.from(`${config.au}:${config.ap}`, 'utf8').toString('base64');
    const options = {
        hostname: config.ah,
        port: config.port,
        path: path,
        method: 'DELETE',
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
    let debug = {
        request: {
            options: options,
            timestamp: new Date(),
            content: ''
        },
        response: {}
    };
    const req = https.request(options, res => {
        let body = "";
        debug.response.statusCode = res.statusCode;
        debug.response.headers = res.headers;
        res.on('data', chunk => {
            body += chunk.toString();
        });

        res.on('end', () => {
            debug.response.timestamp = new Date();
            debug.response.content = body;
            let segments = path.split('/');
            let file = segments[segments.length - 1] + '.delete.json';
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
                logHttpError(path, 'DELETE', obj);
                callback(null, obj, res);
            }
        });
    });

    req.on('error', error => {
        logHttpError(path, 'POST', error);
        if (callback) callback(null, error, null);
    });
    req.write("{}");
    req.end();
}
