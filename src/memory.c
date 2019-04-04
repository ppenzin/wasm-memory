#include <stddef.h>

#define export __attribute__ ((visibility("default"))) 

export
void * memset(void * ptr, int value, size_t num) {
  size_t i;
  unsigned char * p = ptr;

  for (i = 0; i < num; ++i)
    *(p++) = (unsigned char)value;

  return ptr;
}

/* Simple memory allocator inspired by dlmalloc
 * ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * Finds an unallocated memory chunk that fits requested size. Maintains a free
 * list (deallocated chunks), starting pointer for which is placed right at the
 * beginning of the heap.
 *
 * Allocated chunk looks like this:
 * -----------------------------
 * (size_t) chunk_size
 * -----------------------------
 * (void) data <-- return ptr
 * -----------------------------
 *
 * Free chunk:
 * -----------------------------
 * (size_t) chunk_size
 * -----------------------------
 * (void *) previous
 * -----------------------------
 * (void *) next
 * -----------------------------
 * (size_t) chunk_size
 * -----------------------------
 *
 * Free chunks storing size at the beginning and end is done for ease of
 * merging two adjacent free chunks. After chunks is freed its size does not
 * change, which imoses a minimal offset between starting pointers of two
 * adjacent chunks. Free chunks are organized into a double linked list for
 * ease of lookups.
 */

extern unsigned char __heap_base;

/// Minimal offset between size of the current chunk and begining of the next
/// one; accomodates two pointers needed for doubly-linked list of free chunks
/// and extra size value placed at end of every free chunk
const size_t min_chunk_offset = 2 * sizeof(void *) + sizeof(size_t);

export
void * malloc(size_t size) {
  // FIXME alignment

  void * heap_ptr = &__heap_base;

  // Heap starts with a pointer to the free list
  void * free_list_ptr = *((void **)heap_ptr);
  // Followed by the first allocated chunk (if allocated)
  void * current_chunk = (size_t*)heap_ptr + 1;

  // No free list --
  if (free_list_ptr == 0) {
    // -- find the end of allocated memory

    // Every chunk starts with its size (in bytes)
    size_t chunk_size = *(size_t*)current_chunk;
    size_t offset = (chunk_size < min_chunk_offset) ? min_chunk_offset : chunk_size;
    while (chunk_size != 0) { // Loop through all used chunks
      current_chunk = (unsigned char*)current_chunk + offset;
      chunk_size = *(size_t*)current_chunk;
      offset = (chunk_size < min_chunk_offset) ? min_chunk_offset : chunk_size;
    }

    // Set the first free chunk up to be used
    *((size_t*)current_chunk) = size;
    return (void*)((size_t*)current_chunk + 1);
  }

  return &__heap_base;
}

export
void free(void * ptr) {
}

