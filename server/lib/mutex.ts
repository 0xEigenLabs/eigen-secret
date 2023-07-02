import { Mutex } from "async-mutex";
const mutex = new Mutex();
// all the db transaction should obtain the mutex.
export default mutex;
