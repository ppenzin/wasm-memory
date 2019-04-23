#include <stddef.h>
#include <math.h>

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
 * (void *) next
 * -----------------------------
 * (void *) previous
 * -----------------------------
 * (size_t) chunk_size
 * -----------------------------
 *
 * Free chunks storing size at the beginning and end is done for ease of
 * merging two adjacent free chunks. After chunks is freed its size does not
 * change, which imoses a minimal offset between starting pointers of two
 * adjacent chunks. Free chunks are organized into a double linked list sorted
 * by size (smaller to larger).
 * 
 * Zero malloc returns NULL.
 */

extern unsigned char __heap_base;

/// Free chunk header
///
/// In full chunk this is followed by (optional) empty space and another size_t
/// field containing chunk size
typedef struct {
  size_t size;
  void * previous;
  void * next;
} free_chunk_header;

/// Minimal effective size is the size of the values that get added to a free
/// chunk (effectively size of free_chunk_header above
const size_t min_effective_size = sizeof(free_chunk_header);

/// Minimal offset between start of the current chunk and begining of the next
/// one, including the size value
///
/// To support setting up the free chunks the offset has to accomodate a size
/// value, two pointers needed for doubly-linked list of free chunks, and one
/// more size value
const size_t min_chunk_offset = min_effective_size + sizeof(size_t);

/// WASM page size in bytes
const size_t page_size = 64 * 1024;

/// Attempt to allocate from the free list
/// \param list pointer to the locaiton pointing to the beginning of the list
/// \param size malloc size parameter
/// \return 0 if no appropriately-sized free chunk
void * free_list_alloc(free_chunk_header ** list, size_t size) {
  if (!list || !(*list)) return 0;

  // Free chunk
  free_chunk_header * chunk = *list;
  // Look for chunk big enough for our allocation
  while (chunk && (chunk->size < min_effective_size ? min_effective_size : chunk->size) < size) {
    chunk = chunk->next;
  }
  // Found
  if (chunk) {
    // Remove from the free list
    if (!chunk->next) { // Last
      if (!chunk->previous) { // Only one
        // Zero out free list pointer
        *list = 0;
      } else {
        // Cut the link to previous element
        ((free_chunk_header *)chunk->previous)->next = 0;
        chunk->previous = 0;
      }
    } else {
      if (!chunk->previous) { // First one
        // TODO
      } else {
        // TODO
      }
    }
    
    // TODO split tail into a different chunk if it is big enough

    // Set the size and return
    chunk->size = size;
    return (size_t *)chunk + 1;
  }

  // Not found
  return 0;
}

export
void * malloc(size_t size) {
  // FIXME alignment

  if (size == 0)
    return 0;

  // Start of the heap
  void * heap_ptr = &__heap_base;

  // Heap starts with a pointer to the free list
  void * chunk = free_list_alloc(heap_ptr, size);
  // Try to allocate on the free list first
  if (chunk)
    return chunk;

  // No free list -- find the end of allocated memory

  // Free list pointer in the heap is followed by the first allocated chunk
  chunk = (size_t*)heap_ptr + 1;

  // Every chunk starts with its size (in bytes)
  size_t chunk_size = *(size_t*)chunk;
  size_t offset = (chunk_size < min_chunk_offset) ? min_chunk_offset : chunk_size;
  while (chunk_size != 0) { // Loop through all used chunks
    chunk = (unsigned char*)chunk + offset;
    chunk_size = *(size_t*)chunk;
    offset = (chunk_size < min_chunk_offset) ? min_chunk_offset : chunk_size;
  }

  // Check if we have enough memory left
  size_t available = (size_t)(page_size * __builtin_wasm_memory_size(0)) - (size_t)chunk;
  size_t needed = (size < min_chunk_offset) ? min_chunk_offset : size;

  // Add memory
  if (available < needed) {
     size_t pages = ceil(1.0 * (needed - available) / page_size);
     // Failed to allocate memory
     if (__builtin_wasm_memory_grow(0, pages) == -1)
       return 0;
  }

  // Set the first free chunk up to be used
  *((size_t*)chunk) = size;
  return (void*)((size_t*)chunk + 1);
}

export
void free(void * ptr) {
  size_t * size_ptr = ptr - 1;
  size_t next_offset = (*size_ptr < min_chunk_offset) ? min_chunk_offset: *size_ptr;
  void * next_ptr = (unsigned char *)ptr + next_offset;

  // TODO check if we can merge with the previous chunk

  if (*((size_t *)next_ptr) == 0) {
    // Tail chunk -- no allocated chunk after
    *size_ptr = 0;
    return;
  } else {
    // TODO put on free list or merge with next if it is free
  }
}

