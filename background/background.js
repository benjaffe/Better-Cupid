(function(){

var version = 0,
	tabs = {},
	regex = {
		targetSite: /^https?:\/\/(?:[^\.]+\.)?okcupid\.com/i
	};

chrome.tabs.onUpdated.addListener(function(_, info, tab) {
	if ( regex.targetSite.test(tab.url) ) {
		tabs[tab.id] = tab;
	} else {
		delete tabs[tab.id];
	}
});

chrome.tabs.onRemoved.addListener(function(tabid, info) {
	delete tabs[tabid];
});

chrome.windows.getAll({ populate: true }, function(windowArray) {
	$.each(windowArray, function(_, window) {
		$.each(window.tabs, function(_, tab) {
			if ( regex.targetSite.test(tab.url) ) {
				tabs[tab.id] = tab;
			}
		});
	});
});

	var fetch_cache = {};
	
	var requestHandler = function(request, sender, sendResponse) {
		var response = { type: request.type };
		switch ( request.type ) {
			
			case "db.clear":
				core.db.clear(request.key);
				break;
				
			case "db.get":
				response.key = request.key;
				response.value = core.db.get(request.key);
				break;
				
			case "db.get.all":
				var data = {};
				for ( k in localStorage ) {
					data[k] = localStorage[k];
				}
				response.data = data;
				break;
			
			case "db.set":
				core.db.set(request.key, request.value);
				break;
			
			case "fetch":
				var url = request.url,
					key = url.toLowerCase(),
					entry = fetch_cache[key],
					age = request.age || 60*60*1000,
					timestamp = (new Date()).getTime();
				if ( request.force || !entry || !entry.data || !entry.timestamp || entry.timestamp + age < timestamp ) {
					request.type = request.requestType || "GET";
					request.key = key;
					request.success = function(data, status, jqXHR) {
						fetch_cache[this.key] = {
							data: data,
							timestamp: (new Date()).getTime()
						};
						response.data = data;
						sendResponse(response);
					}
					request.error = function(jqXHR, status, message) {
						response.error = message;
						sendResponse(response);
					}
					$.ajax(request);
					return true;
				} else {
					response.cached = true;
					response.data = entry.data;
				}
				break;
		}
		sendResponse(response);
	};
	
	chrome.extension.onMessage.addListener(requestHandler);
	
	chrome.browserAction.onClicked.addListener(function(tab) {
		window.open("http://www.okcupid.com");
	});
	/*
	chrome.browserAction.setPopup({popup:"popup.html"})
	setTimeout(function() {
		chrome.browserAction.setPopup({popup:""})
	}, 1000)
	chrome.browserAction.setBadgeBackgroundColor({color:[255,255,255,100]})
	chrome.browserAction.setBadgeText({text:"1"})
	//*/
	
	
// -- Upgrading --------------------------------------------------------------------------------------------------------

(function() {
	
	var lastVersion = core.db.get("--version") || "0.0.0";
	core.manifest(function(manifest) {
		if ( lastVersion !== manifest.version ) {
			(function() {
				var old = {},
					modules = {};
				
				lastVersion = parseFloat(lastVersion);
				
				if ( lastVersion < 0.7 ) {
					
					modules.youMightLike = new Module({ id: "you-might-like" });
					modules.recentlyVisited = new Module({ id: "recently-visited" });
					
					old.settings = core.db.get("settings");
					if ( old.settings ) {
						if ( old.settings.hideYouMightLike !== undefined ) {
							modules.youMightLike.db.set("hide", old.settings.hideYouMightLike);
							delete old.settings.hideYouMightLike;
						}
						if ( old.settings.numRecentlyVisitedRows !== undefined ) {
							modules.recentlyVisited.db.set("maxRowCount", old.settings.numRecentlyVisitedRows);
							delete old.settings.numRecentlyVisitedRows;
						}
					}
					
					old.recentlyVisited = core.db.get("recentlyVisited");
					if ( old.recentlyVisited ) {
						modules.recentlyVisited.db.set("recentlyVisited", old.recentlyVisited);
						core.db.clear("recentlyVisited");
					}
					
					core.db.clear("visits");
				}
				
				old.count = 0;
				for ( old.key in old.settings ) {
					old.count++;
				}
				if ( old.count === 0 ) {
					core.db.clear("settings");
				} else {
					core.db.set("settings", old.settings);
				}
				
			})();
			
			core.db.set("--version", manifest.version);
		}
	});

})();
	
})();