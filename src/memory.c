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
