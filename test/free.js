var imports = {memory: new WebAssembly.Memory({initial:2})};
// FIXME `read/snarf/etc` is engine-specific, need a better way to read a file
// https://stackoverflow.com/questions/46159438/how-to-read-webassembly-file-it-javascript-from-the-local-file-system-with-nativ
const module = new WebAssembly.Module(read('mem.wasm', 'binary'));
const instance = new WebAssembly.Instance(module, { "env" : imports }).exports;
var u8_data = new Uint8Array(imports["memory"]["buffer"]);

// Convert 4 uint8 values to a single int32 value
function uchar2int32(arr, off) {
  var u8arr = new Uint8Array([arr[off], arr[off+1], arr[off+2], arr[off+3]]);
  return new Int32Array(u8arr.buffer)[0];
}

// Write a four byte integer into the byte array
function write_int32(arr, off, val) {
  var i32arr = new Int32Array([val]);
  var u8arr = new Uint8Array(i32arr.buffer);
  for (var i = 0; i < u8arr.length; ++i) {
    arr[off + i] = u8arr[i];
  }
}

/**** Free the only chunk in the heap ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == 0
 * -----------------------
 * (size_t) chunk size = 8
 * -----------------------
 * (void *) alloc == ptr
 * -----------------------
 * (size_t) chunk size = 0 (empty)
 */
write_int32(u8_data, instance.__heap_base, 0);
write_int32(u8_data, instance.__heap_base + 4, 8);
write_int32(u8_data, instance.__heap_base + 20, 0);

instance.free(instance.__heap_base + 8);

// Expect the chunk would be deallocated without getting added to the free list
var passed = (uchar2int32(u8_data, instance.__heap_base) == 0)
             && (uchar2int32(u8_data, instance.__heap_base + 4) == 0)
             && (uchar2int32(u8_data, instance.__heap_base + 20) == 0);

/**** Free a non-tail chunk ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == 0
 * -----------------------
 * (size_t) chunk size = 8
 * -----------------------
 * (void *) alloc == ptr
 * -----------------------
 * (size_t) chunk size = 16
 */
write_int32(u8_data, instance.__heap_base, 0);
write_int32(u8_data, instance.__heap_base + 4, 8);
write_int32(u8_data, instance.__heap_base + 20, 16);

instance.free(instance.__heap_base + 8);

/* Expected (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 16
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 16);

/**** Prepend to free list ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 16 -- free chunk
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * 4 bytes empty
 * -----------------------
 * (size_t) chunk size = 16
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk to be deallocated
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 4, 16);
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, 0);
write_int32(u8_data, instance.__heap_base + 20, 16);
write_int32(u8_data, instance.__heap_base + 24, 12);
write_int32(u8_data, instance.__heap_base + 40, 12);
write_int32(u8_data, instance.__heap_base + 56, 12);

instance.free(instance.__heap_base + 44);

/* Expected (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 40
 * -----------------------
 * (size_t) chunk size = 16 -- free chunk
 * -----------------------
 * (void *) previous ptr = __heap_base + 40
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * 4 bytes empty
 * -----------------------
 * (size_t) chunk size = 16
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 12 -- deallocated chunk
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 40)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == instance.__heap_base + 40)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 24) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 40) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 44) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 48) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 52) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 56) == 12)

/**** Append to free list ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12 -- free chunk
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 16 -- used chunk to be deallocated
 * -----------------------
 * 16 byte alloc
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 4, 12);
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, 0);
write_int32(u8_data, instance.__heap_base + 16, 12);
write_int32(u8_data, instance.__heap_base + 20, 12);
write_int32(u8_data, instance.__heap_base + 36, 16);
write_int32(u8_data, instance.__heap_base + 56, 12);

instance.free(instance.__heap_base + 40);

/* Expected (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12 -- free chunk
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = __heap_base + 36
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 16 -- deallocated chunk
 * -----------------------
 * (void *) previous ptr = __heap_base + 4
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * 4 bytes empty
 * -----------------------
 * (size_t) chunk size = 16
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == instance.__heap_base + 36)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 36) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 40) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 44) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 52) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 56) == 12)

/**** Insert into free list ****/

/* Set up (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12 -- free chunk 0
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = __heap_base + 36
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 16 -- free chunk 1
 * -----------------------
 * (void *) previous ptr = __heap_base + 4
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * 4 bytes empty
 * -----------------------
 * (size_t) chunk size = 16
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 16 -- chunk to deallocate
 * -----------------------
 * 16 byte alloc
 * -----------------------
 * (size_t) chunk size = 12
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
// Free chunk
write_int32(u8_data, instance.__heap_base + 4, 12);
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, instance.__heap_base + 36);
write_int32(u8_data, instance.__heap_base + 16, 12);
// Used chunk
write_int32(u8_data, instance.__heap_base + 20, 12);
// Free chunk
write_int32(u8_data, instance.__heap_base + 36, 16);
write_int32(u8_data, instance.__heap_base + 40, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 44, 0);
write_int32(u8_data, instance.__heap_base + 52, 16);
// Used chunk
write_int32(u8_data, instance.__heap_base + 56, 12);
// Used chunk to deallocate
write_int32(u8_data, instance.__heap_base + 72, 16);
// One more used chunk
write_int32(u8_data, instance.__heap_base + 92, 12);

instance.free(instance.__heap_base + 76);

/* Expected (start at __heap_base)
 * -----------------------
 * (void *) free list == __heap_base + 4
 * -----------------------
 * (size_t) chunk size = 12 -- free chunk 0
 * -----------------------
 * (void *) previous ptr = 0
 * -----------------------
 * (void *) next ptr = __heap_base + 76
 * -----------------------
 * (size_t) chunk size = 12
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 16 -- free chunk 2
 * -----------------------
 * (void *) previous ptr = __heap_base + 76
 * -----------------------
 * (void *) next ptr = 0
 * -----------------------
 * 4 bytes empty
 * -----------------------
 * (size_t) chunk size = 16
 * -----------------------
 * (size_t) chunk size = 12 -- used chunk (prevent merging)
 * -----------------------
 * 12 byte alloc
 * -----------------------
 * (size_t) chunk size = 16 -- free chunk 1
 * -----------------------
 * (void *) previous ptr = __heap_base + 4
 * -----------------------
 * (void *) next ptr = __heap_base + 36
 * -----------------------
 * 4 bytes empty
 * -----------------------
 * (size_t) chunk size = 16
 * -----------------------
 * (size_t) chunk size = 12
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == instance.__heap_base + 72)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 36) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 40) == instance.__heap_base + 72)
                && (uchar2int32(u8_data, instance.__heap_base + 44) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 52) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 56) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 72) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 76) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 80) == instance.__heap_base + 36)
                && (uchar2int32(u8_data, instance.__heap_base + 88) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 92) == 12);

if (passed) {
  print("PASS");
} else {
  print("FAIL");
}
