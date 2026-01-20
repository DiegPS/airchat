export namespace main {
	
	export class LiveCountsUserData {
	    id: string;
	    username: string;
	    avatar: string;
	
	    static createFrom(source: any = {}) {
	        return new LiveCountsUserData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.username = source["username"];
	        this.avatar = source["avatar"];
	    }
	}
	export class LiveCountsSearchResponse {
	    cache: boolean;
	    success: boolean;
	    userData: LiveCountsUserData[];
	
	    static createFrom(source: any = {}) {
	        return new LiveCountsSearchResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cache = source["cache"];
	        this.success = source["success"];
	        this.userData = this.convertValues(source["userData"], LiveCountsUserData);
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
	
	export class YoutubeStats {
	    cache: boolean;
	    success: boolean;
	    followerCount: number;
	    bottomOdos: number[];
	    isStudioCount: boolean;
	
	    static createFrom(source: any = {}) {
	        return new YoutubeStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cache = source["cache"];
	        this.success = source["success"];
	        this.followerCount = source["followerCount"];
	        this.bottomOdos = source["bottomOdos"];
	        this.isStudioCount = source["isStudioCount"];
	    }
	}

}

