export namespace http {
	
	export class StreamURLs {
	    FlvOrigin: string;
	    FlvHD: string;
	    FlvSD: string;
	    FlvLD: string;
	    FlvAudio: string;
	
	    static createFrom(source: any = {}) {
	        return new StreamURLs(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.FlvOrigin = source["FlvOrigin"];
	        this.FlvHD = source["FlvHD"];
	        this.FlvSD = source["FlvSD"];
	        this.FlvLD = source["FlvLD"];
	        this.FlvAudio = source["FlvAudio"];
	    }
	}
	export class RoomInfo {
	    Title: string;
	    Viewers: number;
	    Likes: number;
	    TotalUser: number;
	    StreamURL?: StreamURLs;
	
	    static createFrom(source: any = {}) {
	        return new RoomInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Title = source["Title"];
	        this.Viewers = source["Viewers"];
	        this.Likes = source["Likes"];
	        this.TotalUser = source["TotalUser"];
	        this.StreamURL = this.convertValues(source["StreamURL"], StreamURLs);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class TikTokConnectOptions {
	    cdn: string;
	    customCdn: string;
	    timeoutSeconds: number;
	    maxRetries: number;
	    staleTimeoutSeconds: number;
	    userAgent: string;
	    cookies: string;
	    language: string;
	    region: string;
	    proxy: string;
	    compress: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TikTokConnectOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cdn = source["cdn"];
	        this.customCdn = source["customCdn"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	        this.maxRetries = source["maxRetries"];
	        this.staleTimeoutSeconds = source["staleTimeoutSeconds"];
	        this.userAgent = source["userAgent"];
	        this.cookies = source["cookies"];
	        this.language = source["language"];
	        this.region = source["region"];
	        this.proxy = source["proxy"];
	        this.compress = source["compress"];
	    }
	}

}

