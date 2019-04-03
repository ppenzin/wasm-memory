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

extern unsigned char __heap_base;

/**** Simple memory allocator inspired by dlmalloc ****/

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
    while (chunk_size != 0) { // Loop through all used chunks
      current_chunk = (unsigned char*)current_chunk + chunk_size;
      chunk_size = *(size_t*)current_chunk;
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

