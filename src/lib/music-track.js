// The one song the header player loops. Kept behind this little module so
// the no-music build can alias it to music-track-empty.js instead — that
// way the song never enters the build and the file stays tiny.
import url from "../assets/i-only-say-morning.opus";

export default url;
