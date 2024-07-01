"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetch = void 0;
var url = require("url");
var isAbsoluteUrl = require("is-absolute-url");
var main_1 = require("./main");
var isomorphicFetch = require('isomorphic-fetch');
var isNode = typeof process === 'object' && process.versions && !!process.versions.node;
var nodeHttps = isNode && require('https');
var isHttpsRegex = /^https\:/;
function issueRequest(baseUrl, req, init) {
    var reqUrl = (req instanceof Request) ? req.url : req;
    var isRelativeUrl = reqUrl && !isAbsoluteUrl(reqUrl);
    // Resolve relative URLs
    if (baseUrl) {
        if (req instanceof Request) {
            var reqAsRequest = req;
            reqAsRequest.url = url.resolve(baseUrl, reqAsRequest.url);
        }
        else {
            req = url.resolve(baseUrl, req);
        }
    }
    else if (isNode) {
        // TODO: Consider only throwing if it's a relative URL, since absolute ones would work fine
        throw new Error("\n            When running outside the browser (e.g., in Node.js), you must specify a base URL\n            before invoking domain-task's 'fetch' wrapper.\n            Example:\n                import { baseUrl } from 'domain-task/fetch';\n                baseUrl('http://example.com'); // Relative URLs will be resolved against this\n        ");
    }
    init = applyHttpsAgentPolicy(init, isRelativeUrl, baseUrl);
    return isomorphicFetch(req, init);
}
function applyHttpsAgentPolicy(init, isRelativeUrl, baseUrl) {
    // HTTPS is awkward in Node because it uses a built-in list of CAs, rather than recognizing
    // the OS's system-level CA list. There are dozens of issues filed against Node about this,
    // but still (as of v8.0.0) no resolution besides manually duplicating your CA config.
    //
    // The biggest problem for typical isomorphic-SPA development this causes is that if you're
    // using a self-signed localhost cert in development, Node won't be able to make API calls
    // to it (e.g., https://github.com/aspnet/JavaScriptServices/issues/1089). Developers could
    // fix this by either manually configuring the cert in Node (which is extremely inconvenient,
    // especially if multiple devs on a team have different self-signed localhost certs), or by
    // disabling cert verification on their API requests.
    //
    // Fortunately, 'domain-task/fetch' knows when you're making a relative-URL request to your
    // own web server (as opposed to an arbitrary request to anywhere else). In this specific case,
    // there's no real point in cert verification, since the request never even leaves the machine
    // so a MitM attack isn't meaningful. So by default, when your code is running in Node and
    // is making a relative-URL request, *and* if you haven't explicitly configured any option
    // for 'agent' (which would let you set up other HTTPS-handling policies), then we automatically
    // disable cert verification for that request.
    if (isNode && isRelativeUrl) {
        var isHttps = baseUrl && isHttpsRegex.test(baseUrl);
        if (isHttps) {
            var hasAgentConfig = init && ('agent' in init);
            if (!hasAgentConfig) {
                var agentForRequest = new (nodeHttps.Agent)({ rejectUnauthorized: false });
                init = init || {};
                init.agent = agentForRequest;
            }
        }
    }
    return init;
}
function fetch(url, init) {
    // As of domain-task 2.0.0, we no longer auto-add the 'fetch' promise to the current domain task list.
    // This is because it's misleading to do so, and can result in race-condition bugs, e.g.,
    // https://github.com/aspnet/JavaScriptServices/issues/166
    //
    // Consider this usage:
    // 
    // import { fetch } from 'domain-task/fetch';
    // fetch(something).then(callback1).then(callback2) ...etc... .then(data => updateCriticalAppState);
    //
    // If we auto-add the very first 'fetch' promise to the domain task list, then the domain task completion
    // callback might fire at any point among all the chained callbacks. If there are enough chained callbacks,
    // it's likely to occur before the final 'updateCriticalAppState' one. Previously we thought it was enough
    // for domain-task to use setTimeout(..., 0) so that its action occurred after all synchronously-scheduled
    // chained promise callbacks, but this turns out not to be the case. Current versions of Node will run
    // setTimeout-scheduled callbacks *before* setImmediate ones, if their timeout has elapsed. So even if you
    // use setTimeout(..., 10), then this callback will run before setImmediate(...) if there were 10ms or more
    // of CPU-blocking activity. In other words, a race condition.
    //
    // The correct design is for the final chained promise to be the thing added to the domain task list, but
    // this can only be done by the developer and not baked into the 'fetch' API. The developer needs to write
    // something like:
    //
    // var myTask = fetch(something).then(callback1).then(callback2) ...etc... .then(data => updateCriticalAppState);
    // addDomainTask(myTask);
    //
    // ... so that the domain-tasks-completed callback never fires until after 'updateCriticalAppState'.
    return issueRequest(main_1.baseUrl(), url, init);
}
exports.fetch = fetch;
// Re-exporting baseUrl from this module for back-compatibility only
// Newer code that wants to access baseUrl should use the version exported from the root of this package
var main_2 = require("./main");
Object.defineProperty(exports, "baseUrl", { enumerable: true, get: function () { return main_2.baseUrl; } });
