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

/**** Zero-size allocation ****/
var ptr = instance.malloc(0);

// Expect NULL
var passed = (ptr == 0);

/**** Allocate with empty heap ****/
ptr = instance.malloc(6);

/* Expected heap (starts at __heap_base):
 * -----------------------
 * (void *) free list == 0
 * -----------------------
 * (size_t) chunk size = 6
 * -----------------------
 * (void *) alloc == ptr
 * -----------------------
 */
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 6)
                && (ptr == instance.__heap_base + 8);

/**** Add one more alloc ****/
ptr = instance.malloc(4);

/* Expected heap (starts at __heap_base):
 * ------------------------
 * (void *) free list == 0
 * ------------------------
 * (size_t) chunk size = 6
 * ------------------------
 * 6 bytes (previous alloc)
 * + 6 bytes to get to
 * 12 bytes required
 * between chunks
 * ------------------------
 * (size_t) chunk size = 4
 * ------------------------
 * (void *) alloc == ptr
 * ------------------------
 */

passed = passed && (uchar2int32(u8_data, instance.__heap_base) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 6)
                && (uchar2int32(u8_data, instance.__heap_base + 20) == 4)
                && (ptr == instance.__heap_base + 24);

/**** Allocation crossing page boundary ****/

// Start with an empty free list and one allocated chunk ending 4 bytes before
// the end of the page (to accomodate size of next chunk)

const page_size = 64 * 1024; // WebAssembly uses 64 KB pages
write_int32(u8_data, instance.__heap_base, 0); // Empty free list
write_int32(u8_data, instance.__heap_base + 4,
            (u8_data.length - instance.__heap_base - 8)); // Leave 4 bytes at the end

var mem_size = imports.memory.buffer.byteLength;

ptr = instance.malloc(4);

// Size change would invalidate the array
u8_data = new Uint8Array(imports.memory.buffer);

passed = passed && (ptr == mem_size) // Allocated right at the boundary
                && (uchar2int32(u8_data, ptr - 4) == 4)
                && (imports.memory.buffer.byteLength = mem_size + page_size);

/**** Multi-page allocation ****/

// Empty heap
write_int32(u8_data, instance.__heap_base, 0);
write_int32(u8_data, instance.__heap_base + 4, 0);

ptr = instance.malloc(5 * page_size);

u8_data = new Uint8Array(imports.memory.buffer);
passed = passed && (uchar2int32(u8_data, instance.__heap_base) == 0)
                && (uchar2int32(u8_data, instance.__heap_base + 4) == 5*page_size)
                && (ptr == instance.__heap_base + 8)
                && (imports.memory.buffer.byteLength = 6 * page_size);

if (passed)
  print("PASS");
else
  print("FAIL");

