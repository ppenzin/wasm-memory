#include <stddef.h>

// FIXME ceiling function availability
// Used to include math.h for the definition, relying on Clang to provide a
// builtin (not ideal solution)
double ceil(double);

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
 * by size (smaller to larger). Size value for the free chunks is promoted to
 * the minimal phyisical size.
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

/// Find the first chunk that would be able to accomodate a particular size,
/// assume that every size is accurate
free_chunk_header * find_free_chunk(free_chunk_header * list, size_t size) {
  free_chunk_header * chunk = list;
  // Look for chunk big enough for the size
  while (chunk && chunk->size < size) {
    chunk = chunk->next;
  }
  return chunk;
}


/// Attempt to allocate from the free list
/// \param list pointer to the locaiton pointing to the beginning of the list
/// \param size malloc size parameter
/// \return 0 if no appropriately-sized free chunk
void * free_list_alloc(free_chunk_header ** list, size_t size) {
  if (!list || !(*list)) return 0;

  // Find big enough free chunk
  free_chunk_header * chunk = find_free_chunk(*list, size);

  // Not found
  if (!chunk)
    return 0;

  // Found -- remove from the free list
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
      *list = chunk->next;
      ((free_chunk_header *)chunk->next)->previous = 0;
    } else {
      ((free_chunk_header *)chunk->previous)->next = chunk->next;
      ((free_chunk_header *)chunk->next)->previous = chunk->previous;
    }
  }

  // TODO split tail into a different chunk if it is big enough

  // Set the size and return
  chunk->size = size;
  return (size_t *)chunk + 1;
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
  if (!ptr) return; // FIXME error?

  size_t * size_ptr = (size_t*)ptr - 1;

  if (*size_ptr == 0) return; // FIXME error?

  free_chunk_header ** list = (void*)&__heap_base;
  size_t effective_size = (*size_ptr < min_effective_size) ? min_effective_size: *size_ptr;
  void * next_chunk_ptr = (unsigned char *)ptr + effective_size;

  // TODO check if we can merge with the previous chunk

  if (*((size_t *)next_chunk_ptr) == 0) {
    // Tail chunk -- no allocated chunk after
    *size_ptr = 0;
    return;
  }

  free_chunk_header * hdr = (void*)size_ptr;
  // Promote chunk size to effective size and duplicate size at the end
  *((size_t *)next_chunk_ptr - 1) = hdr->size = effective_size;
  hdr->previous = hdr->next =  0;

  // FIXME Merge with adjacent chunk if that is free

  // Find first free chunk of the same or greater size
  free_chunk_header * next = find_free_chunk(*list, effective_size);

  if (!next) { // First or smallest chunk
    hdr->next = *list;
    *list = hdr;
  } else {
    hdr->next = next;
    hdr->previous = next->previous;
    ((free_chunk_header *)hdr->previous)->next = hdr;
    next->previous = hdr;
  }

}

