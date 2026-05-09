export namespace main {
	
	export class OBSAudioInput {
	    name: string;
	    muted: boolean;
	    volume: number;
	
	    static createFrom(source: any = {}) {
	        return new OBSAudioInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.muted = source["muted"];
	        this.volume = source["volume"];
	    }
	}

}
