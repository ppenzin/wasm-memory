var imports = {memory: new WebAssembly.Memory({initial:2})};
// FIXME `read/snarf/etc` is engine-specific, need a better way to read a file
// https://stackoverflow.com/questions/46159438/how-to-read-webassembly-file-it-javascript-from-the-local-file-system-with-nativ
const module = new WebAssembly.Module(read('mem.wasm', 'binary'));
const instance = new WebAssembly.Instance(module, { "env" : imports }).exports;
var u8_data = new Uint8Array(imports.memory.buffer);

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

/**** Fail to claim an empty chunk ****/

/* Set up (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 12 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * (size_t) chunk size = 12
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 4, 12);
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, 0);
write_int32(u8_data, instance.__heap_base + 16, 12);
write_int32(u8_data, instance.__heap_base + 20, 12);

// Should allocate a new chunk, as available free chunk is too small
ptr = instance.malloc(16);

/* Expected (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 12 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * (size_t) chunk size = 12
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (new chunk)
 * ------------------------
 * + 16 bytes <= ptr
 * ------------------------
 */
var passed = (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
          && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
          && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
          && (uchar2int32(u8_data, instance.__heap_base + 12) == 0)
          && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
          && (uchar2int32(u8_data, instance.__heap_base + 20) == 12)
          && (uchar2int32(u8_data, instance.__heap_base + 36) == 16)
          && (ptr == instance.__heap_base + 40);

/**** Claim chunk at the end of free list ****/

/* Set up (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 12 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = __heap_base + 36
 * ------------------------
 * (size_t) chunk size = 12
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = __heap_base + 4
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 20 (used chunk)
 * ------------------------
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 4, 12); // Free chunk
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, instance.__heap_base + 36);
write_int32(u8_data, instance.__heap_base + 16, 12);
write_int32(u8_data, instance.__heap_base + 20, 12); // Used chunk
write_int32(u8_data, instance.__heap_base + 36, 16); // Free chunk
write_int32(u8_data, instance.__heap_base + 40, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 44, 0);
write_int32(u8_data, instance.__heap_base + 52, 16);
write_int32(u8_data, instance.__heap_base + 56, 20); // Used chunk
write_int32(u8_data, instance.__heap_base + 80, 0); // End of allocated memory

ptr = instance.malloc(15);

/* Expected (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 12 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * (size_t) chunk size = 12
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 15 (Newly used chunk)
 * ------------------------
 * + 16 bytes <= ptr
 * ------------------------
 * (size_t) chunk size = 20 (used chunk)
 * ------------------------
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 36) == 15)
                && (ptr == instance.__heap_base + 40)
                && (uchar2int32(u8_data, instance.__heap_base + 56) == 20)
                && (uchar2int32(u8_data, instance.__heap_base + 80) == 0);

/**** Claim chunk at the head of free list ****/

/* Set up (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = __heap_base + 40
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = __heap_base + 4
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 20 (used chunk)
 * ------------------------
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 4, 16); // Free chunk
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, instance.__heap_base + 40);
write_int32(u8_data, instance.__heap_base + 20, 16);
write_int32(u8_data, instance.__heap_base + 24, 12); // Used chunk
write_int32(u8_data, instance.__heap_base + 40, 16); // Free chunk
write_int32(u8_data, instance.__heap_base + 44, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 48, 0);
write_int32(u8_data, instance.__heap_base + 56, 16);
write_int32(u8_data, instance.__heap_base + 60, 20); // Used chunk
write_int32(u8_data, instance.__heap_base + 84, 0); // End of allocated memory

ptr = instance.malloc(15);

/* Expected (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 40
 * ------------------------
 * (size_t) chunk size = 15 (Newly allocated chunk)
 * ------------------------
 * + 16 bytes <= ptr
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 20 (used chunk)
 * ------------------------
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 40)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 15)
                && (ptr == instance.__heap_base + 8)
                && (uchar2int32(u8_data, instance.__heap_base + 24) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 40) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 44) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 48) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 56) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 60) == 20)
                && (uchar2int32(u8_data, instance.__heap_base + 84) == 0);

/**** Claim chunk at the middle of free list ****/

/* Set up (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 12 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = __heap_base + 36
 * ------------------------
 * (size_t) chunk size = 12
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = __heap_base + 4
 * ------------------------
 * (void *) next ptr = __heap_base + 72
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = __heap_base + 36
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 20 (used chunk)
 * ------------------------
 */
write_int32(u8_data, instance.__heap_base, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 4, 12); // Free chunk
write_int32(u8_data, instance.__heap_base + 8, 0);
write_int32(u8_data, instance.__heap_base + 12, instance.__heap_base + 36);
write_int32(u8_data, instance.__heap_base + 16, 12);
write_int32(u8_data, instance.__heap_base + 20, 12); // Used chunk
write_int32(u8_data, instance.__heap_base + 36, 16); // Free chunk
write_int32(u8_data, instance.__heap_base + 40, instance.__heap_base + 4);
write_int32(u8_data, instance.__heap_base + 44, instance.__heap_base + 72);
write_int32(u8_data, instance.__heap_base + 52, 16);
write_int32(u8_data, instance.__heap_base + 56, 12); // Used chunk
write_int32(u8_data, instance.__heap_base + 72, 16); // Free chunk
write_int32(u8_data, instance.__heap_base + 76, instance.__heap_base + 36);
write_int32(u8_data, instance.__heap_base + 80, 0);
write_int32(u8_data, instance.__heap_base + 88, 16);
write_int32(u8_data, instance.__heap_base + 92, 20); // Used chunk
write_int32(u8_data, instance.__heap_base + 116, 0); // End of allocated memory

ptr = instance.malloc(15);

/* Expected (starts at __heap_base):
 * ------------------------
 * (void *) free list = __heap_base + 4
 * ------------------------
 * (size_t) chunk size = 12 (free chunk)
 * ------------------------
 * (void *) previous ptr = 0
 * ------------------------
 * (void *) next ptr = __heap_base + 72
 * ------------------------
 * (size_t) chunk size = 12
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 15 (Newly used chunk)
 * ------------------------
 * + 16 bytes <= ptr
 * ------------------------
 * (size_t) chunk size = 12 (used chunk)
 * ------------------------
 * + 12 bytes
 * ------------------------
 * (size_t) chunk size = 16 (free chunk)
 * ------------------------
 * (void *) previous ptr = __heap_base + 4
 * ------------------------
 * (void *) next ptr = 0
 * ------------------------
 * + 4 bytes (to get to full 16 bytes)
 * ------------------------
 * (size_t) chunk size = 16
 * ------------------------
 * (size_t) chunk size = 20 (used chunk)
 * ------------------------
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 8) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 12) == instance.__heap_base + 72)
                && (uchar2int32(u8_data, instance.__heap_base + 16) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 36) == 15)
                && (ptr == instance.__heap_base + 40)
                && (uchar2int32(u8_data, instance.__heap_base + 56) == 12)
                && (uchar2int32(u8_data, instance.__heap_base + 72) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 76) == instance.__heap_base + 4)
                && (uchar2int32(u8_data, instance.__heap_base + 80) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 88) == 16)
                && (uchar2int32(u8_data, instance.__heap_base + 92) == 20)
                && (uchar2int32(u8_data, instance.__heap_base + 116)== 0);

if (passed)
  print("PASS");
else
  print("FAIL");

