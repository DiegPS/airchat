export namespace main {
	
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

