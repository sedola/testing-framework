var webdriver = require('selenium-webdriver'),
    By = webdriver.By;
var webdriverRemote = require('selenium-webdriver/remote');
var sprintf = require('sprintf-js').sprintf;
var config = require('./config.js');
var fs = require('fs');
var path = require('path');
var until = webdriver.until;

var seleniumServerUrl = 'http://%s:%s/wd/hub';

const PLATFORM  = {
    CHROME: 'CHROME',
    FIREFOX: 'FIREFOX'
};

var getCurrentDate = function() {
    //TODO: method visibility
    var date = new Date();
    var str = `${ date.toJSON().slice(0,10) }_${ date.getHours() }-${ date.getMinutes() }-${ date.getSeconds() }`;

    return str;
};

var logsDirName = getCurrentDate();

var buildDriver = function(platform) {
    var capabilities;

    if(platform === PLATFORM.CHROME) {
        capabilities = webdriver.Capabilities.chrome();
    } else if(platform === PLATFORM.FIREFOX) {
        capabilities = webdriver.Capabilities.firefox();
    }

    var logPreferences = new webdriver.logging.Preferences();
    logPreferences.setLevel('driver', config.seleniumDriverLogLevel);
    logPreferences.setLevel('browser', config.seleniumBrowserLogLevel);

    var seleniumProxy = require('selenium-webdriver/proxy');
    var proxyUrl = config.proxyHost + ':' + config.proxyHttpPort;

    return new webdriver.Builder()
        .usingServer(sprintf(seleniumServerUrl, config.seleniumServerHost, config.seleniumServerPort))
        .withCapabilities(capabilities)
        .setLoggingPrefs(logPreferences)
        .setProxy(seleniumProxy.manual({
            http: proxyUrl
        }))
        .build();
};

var loadDriverOptions = function(driver) {
    if(config.runMaximized) {
    driver.manage().window().maximize();
    }

    if(config.xvfbMode) {
    driver.manage().window().setSize(config.xvfbSettings.windowWidth, config.xvfbSettings.windowHeight);
    }

    driver.setFileDetector(new webdriverRemote.FileDetector);
};

//building driver
var driver = buildDriver(config.platform);
loadDriverOptions(driver);

//methods
var log = function(logMessage, detailedLog) {
    var displayDetailedLog = detailedLog !== undefined ? detailedLog : false;

    if(displayDetailedLog && config.detailedTestLog) {
        console.log(sprintf('LOG-info: %s', logMessage));
    } else if(!displayDetailedLog) {
        console.log(sprintf('LOG: %s', logMessage));
    }
};

var loadPage = function(page) {
    return driver.get(page);
};

var loadPageByRoute = function(routeName, customTimeout) {
    //TODO: implement
};

var validateUrl = function(url, customTimeout) {
    return driver.wait(function() {
            return driver.getCurrentUrl().then(function(currentUrl) {
                return currentUrl.indexOf(url) !== -1;
            });
        },
        defaultTimeout
    );
};

var validateUrlByRoute = function(pageName, customTimeout) {
    //TODO: implement regex-based version
    var url = pageUrlData['basic'][pageName];

    return validateUrl(url, customTimeout);
};

var getDocumentReatyState = function() {
    return driver.executeScript(
        'return document.readyState === \'complete\'',
        ''
    ).then(function(result) {
        return result;
    });
};

var validatePageReadyState = function() {
    //TODO: code style
    return driver.wait(function() {
        return getDocumentReatyState()
            .then(function(value) {
                return value;
            },
            function() {
                return getDocumentReatyState()
                    .then(function(value) {
                        return value;
                    });
            });
    }, defaultTimeout);
};

var waitForElement = function(xpath, customTimeout) {
    var waitTimeout = customTimeout || config.defaultTimeout;

    return driver.wait(until.elementLocated(By.xpath(xpath)), waitTimeout);
};

var findElement = function(xpath, customTimeout) {
    return waitForElement(xpath, customTimeout)
        .then(function() {
            return driver.findElement(By.xpath(xpath));
        });
};

var findElements = function(xpath, customTimeout) {
    return waitForElement(xpath, customTimeout)
        .then(function() {
            return driver.findElements(By.xpath(xpath));
        });
};

var getElementsNumber = function(xpath, customTimeout) {
    return findElements(xpath, customTimeout)
        .then(function(el) {
            return el.length;
        });
};

var isDisplayed = function(xpath, customTimeout) {//visible in sources AND displayed
    return driver.wait(
        function () {
            return findElements(xpath, customTimeout).then(function(elem) {
                return elem[0].isDisplayed();
            });
        },
        defaultTimeout
    ).catch(function(err){
        throw(`isDisplayed failed on element: "${ xpath }" - error message: "${ err.message }", error stack: "${ err.stack }`);
    });
};

var isNotDisplayed = function(xpath, customTimeout) {//element visible in sources and not displayed
    return driver.wait(
        function () {
            return findElements(xpath, customTimeout).then(function(elem) {
                return !elem[0].isDisplayed();
            });
        },
        defaultTimeout
    ).catch(function(err){
        throw(`isNotDisplayed failed on element: "${ xpath }" - error message: "${ err.message }", error stack: "${ err.stack }`);
    });
};

var isElementVisible = function(xpath, customTimeout) {//element visible in sources and may be displayed or not
    var waitTimeout = customTimeout || config.defaultTimeout;

    return driver.wait(
        function () {
            return findElements(xpath).then(function(elem) {
                return elem.length !== 0;
            });
        },
        defaultTimeout
    ).catch(function(err){
        throw(`isElementVisible failed on element: "${ xpath }" - error message: "${ err.message }", error stack: "${ err.stack }`);
    });
};

var isElementNotVisible = function(xpath, customTimeout) {//not visible in sources and not displayed
    var waitTimeout = customTimeout || config.defaultTimeout;

    return validatePageReadyState().then(function() {
        return driver.wait(
            function () {
                return driver.findElements(By.xpath(xpath)).then(function(elem) {
                    return elem.length !== 0;
                });
            },
            defaultTimeout
        ).catch(function(err){
                throw(`isElementNotVisible failed on element: "${ xpath }" - error message: "${ err.message }", error stack: "${ err.stack }`);
        });
    });
};

var jsBasedClick = function(xpath) {
    return findElement(xpath, 0)
        .then(function() {
            return driver.executeScript(
                'document.evaluate(\''+ xpath +'\', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.click();'
            ).then(function() {
                return true;
            });
        });
};

var click = function(xpath, customTimeout) {
    return validatePageReadyState()
        .then(function() {
            return findElement(xpath, customTimeout)
                .then(function(el) {
                    el.click().catch(function(e) {
                        console.log('Standard click failed.');
                        return jsBasedClick(xpath);
                    });
                });
        });
};

var hover = function(xpath, customTimeout) {
    return validatePageReadyState()
        .then(function() {
            return findElement(xpath, customTimeout).then(function(el) {
                return driver.actions().mouseMove(el).perform();
            });
        });
};

var fillInInput = function(xpath, value, blur, customTimeout) {
    return findElement(xpath, customTimeout)
        .clear()
        .sendKeys(typeof blur !== undefined && blur ? value  + '\t': value);
};

var getCheckboxValue = function(xpath, value, customTimeout) {
    //TODO: implement
};

var setCheckboxValue = function(xpath, value, customTimeout) {
    //TODO: implement
};

var selectImage = function(imageInputXP, imageName, customTimeout) {
    //TODO: probably should be changed to select file input
    return waitForElement(imageInputXP, customTimeout)
        .then(function() {
            return findElement(xpath, 0)
                .then(function(el) {
                    var imagePath = config.baseDirectory + 'data/test_files/' + imageName;

                    return el.sendKeys(imagePath);
                });
        });
};

var sleep = function(sleepTime) {
    return new Promise((resolve) => setTimeout(resolve, sleepTime));
};

var getDriver = function() {
    return driver;
};

var getLogsDirName = function() {
    return logsDirName;
};

var cleanBrowserState = function() {
    //TODO: clean browser console logs

    return driver.executeScript('return window.location.hostname.length > 0', '').then(function(result) {//data URLs
        if(result) {
            driver.executeScript('localStorage.clear()');
            driver.executeScript('sessionStorage.clear()');
        } else {
            console.log('Can\'t clean localStorage and sessionStorage');
        }

        return driver.manage().deleteAllCookies();
    });

};

var takeScreenshot = function(fileName, directory) {
    console.log('takeScreenshot');
    var screenshotFilePath = path.join(directory, fileName + ".png");
    console.log('screenshotFilePath: ' + screenshotFilePath);

    return driver.takeScreenshot().then(function(data){
        var base64Data = data.replace(/^data:image\/png;base64,/,"");

        return fs.writeFile(screenshotFilePath, base64Data, 'base64', function(err) {
            if(err) {
                world.log(err, true);
            }
        });
    });
};

//angular-specific methods

var getAngularInputValue = function(xpath, customTimeout) {
    //TODO: implement
};

var validateDynamicAngularInputValue = function(xpath, expectedValue, customTimeout) {
    //TODO: implement
};

var World = function() {
};

module.exports = {
    loadPage: loadPage,
    findElement: findElement,
    findElements: findElements,
    isDisplayed: isDisplayed,
    isNotDisplayed: isNotDisplayed,
    click: click,
    hover: hover,
    fillInInput: fillInInput,
    selectImage: selectImage,
    getDriver: getDriver,
    getCurrentDate: getCurrentDate,
    sleep: sleep,
    getLogsDirName: getLogsDirName,
    cleanBrowserState: cleanBrowserState,
    takeScreenshot: takeScreenshot
};
