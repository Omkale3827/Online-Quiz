// data/seedData.js - Initial Seed Data for QuizCraft Platform

const seedData = {
  users: [
    {
      id: 'user-1',
      name: 'Demo Student',
      email: 'user@omnix.com',
      password: 'user123',
      role: 'ROLE_USER',
      createdAt: '2026-10-01T10:00:00.000Z'
    },
    {
      id: 'admin-1',
      name: 'System Administrator',
      email: 'admin@omnix.com',
      password: 'admin123',
      role: 'ROLE_ADMIN',
      createdAt: '2026-09-15T08:00:00.000Z'
    },
    {
      id: 'user-2',
      name: 'Alex Mercer',
      email: 'alex@example.com',
      password: 'user123',
      role: 'ROLE_USER',
      createdAt: '2026-10-03T12:30:00.000Z'
    },
    {
      id: 'user-3',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      password: 'user123',
      role: 'ROLE_USER',
      createdAt: '2026-10-05T14:15:00.000Z'
    }
  ],
  categories: [
    {
      id: 'cat-gk',
      name: 'General Knowledge',
      icon: 'fa-earth-americas',
      difficulty: 'Easy',
      badgeClass: 'badge-easy',
      description: 'Test your world awareness, history, geography, and current developments.',
      totalTimeMinutes: 5
    },
    {
      id: 'cat-math',
      name: 'Mathematics',
      icon: 'fa-square-root-variable',
      difficulty: 'Medium',
      badgeClass: 'badge-medium',
      description: 'Solve logical and quantitative problems in calculus, algebra, and probability.',
      totalTimeMinutes: 6
    },
    {
      id: 'cat-java',
      name: 'Java Programming',
      icon: 'fa-mug-hot',
      difficulty: 'Medium',
      badgeClass: 'badge-medium',
      description: 'Deep dive into JVM internals, OOP principles, collections, and streams.',
      totalTimeMinutes: 5
    },
    {
      id: 'cat-c',
      name: 'C Programming',
      icon: 'fa-microchip',
      difficulty: 'Hard',
      badgeClass: 'badge-hard',
      description: 'Master memory layout, pointer arithmetic, struct alignment, and macros.',
      totalTimeMinutes: 6
    },
    {
      id: 'cat-python',
      name: 'Python',
      icon: 'fa-brands fa-python',
      difficulty: 'Easy',
      badgeClass: 'badge-easy',
      description: 'Explore idioms, list comprehensions, decorators, and modern Python concepts.',
      totalTimeMinutes: 5
    },
    {
      id: 'cat-webdev',
      name: 'Web Development',
      icon: 'fa-code',
      difficulty: 'Medium',
      badgeClass: 'badge-medium',
      description: 'Modern front-to-back web architecture, JavaScript event loop, CSS, and HTTP.',
      totalTimeMinutes: 5
    }
  ],
  questions: [
    // --- General Knowledge ---
    {
      id: 'q-gk-1',
      categoryId: 'cat-gk',
      questionText: 'Which planet in our solar system is known as the "Red Planet"?',
      options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
      correctIndex: 1,
      explanation: 'Mars is known as the Red Planet due to the prevalent iron oxide (rust) on its surface giving it a reddish hue.'
    },
    {
      id: 'q-gk-2',
      categoryId: 'cat-gk',
      questionText: 'Who was the primary author of the United States Declaration of Independence?',
      options: ['George Washington', 'Benjamin Franklin', 'Thomas Jefferson', 'Alexander Hamilton'],
      correctIndex: 2,
      explanation: 'Thomas Jefferson drafted the Declaration of Independence in June-July 1776.'
    },
    {
      id: 'q-gk-3',
      categoryId: 'cat-gk',
      questionText: 'What is the chemical symbol for the element Gold?',
      options: ['Ag', 'Au', 'Gd', 'Fe'],
      correctIndex: 1,
      explanation: 'Au comes from the Latin word "Aurum", which means shining dawn or gold.'
    },
    {
      id: 'q-gk-4',
      categoryId: 'cat-gk',
      questionText: 'What is the largest ocean on Earth covering more than 30% of the planet surface?',
      options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'],
      correctIndex: 2,
      explanation: 'The Pacific Ocean is the largest and deepest ocean on Earth.'
    },
    {
      id: 'q-gk-5',
      categoryId: 'cat-gk',
      questionText: 'Which ancient wonder was located in Alexandria, Egypt and guided sailors into harbor?',
      options: ['Colossus of Rhodes', 'Lighthouse of Alexandria', 'Hanging Gardens of Babylon', 'Temple of Artemis'],
      correctIndex: 1,
      explanation: 'The Lighthouse of Alexandria (Pharos) was built by the Ptolemaic Kingdom around 280 BC.'
    },

    // --- Mathematics ---
    {
      id: 'q-math-1',
      categoryId: 'cat-math',
      questionText: 'What is the derivative of f(x) = 3x^3 - 5x + 7 with respect to x?',
      options: ['9x^2 - 5', '6x^2 - 5', '9x^3 - 5', '3x^2 - 5x'],
      correctIndex: 0,
      explanation: 'Using the power rule: d/dx(3x^3) = 9x^2, d/dx(-5x) = -5, and d/dx(7) = 0. Therefore f\'(x) = 9x^2 - 5.'
    },
    {
      id: 'q-math-2',
      categoryId: 'cat-math',
      questionText: 'If a fair 6-sided die is rolled twice, what is the probability of obtaining a sum equal to 7?',
      options: ['1/12', '1/6', '7/36', '5/36'],
      correctIndex: 1,
      explanation: 'The combinations that sum to 7 are: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) which is 6 pairs out of 36 outcomes = 6/36 = 1/6.'
    },
    {
      id: 'q-math-3',
      categoryId: 'cat-math',
      questionText: 'What is the value of log2(64)?',
      options: ['4', '5', '6', '8'],
      correctIndex: 2,
      explanation: '2^6 = 64, so log2(64) = 6.'
    },
    {
      id: 'q-math-4',
      categoryId: 'cat-math',
      questionText: 'In a right-angled triangle, if the legs have lengths 9 and 12, what is the length of the hypotenuse?',
      options: ['14', '15', '16', '18'],
      correctIndex: 1,
      explanation: 'By the Pythagorean theorem: c = sqrt(9^2 + 12^2) = sqrt(81 + 144) = sqrt(225) = 15.'
    },
    {
      id: 'q-math-5',
      categoryId: 'cat-math',
      questionText: 'What is the value of the matrix determinant |[2, 3], [1, 4]|?',
      options: ['5', '8', '11', '7'],
      correctIndex: 0,
      explanation: 'Determinant of a 2x2 matrix [[a,b],[c,d]] is ad - bc = (2*4) - (3*1) = 8 - 3 = 5.'
    },

    // --- Java Programming ---
    {
      id: 'q-java-1',
      categoryId: 'cat-java',
      questionText: 'Which memory area in JVM is shared among all threads and holds object instances?',
      options: ['JVM Stack', 'Program Counter (PC) Register', 'Heap Memory', 'Native Method Stack'],
      correctIndex: 2,
      explanation: 'The JVM Heap is the runtime data area from which memory for all class instances and arrays is allocated, shared across threads.'
    },
    {
      id: 'q-java-2',
      categoryId: 'cat-java',
      questionText: 'What does the "final" keyword prevent when applied to a class in Java?',
      options: ['Instantiation of the class', 'Inheritance / Subclassing of the class', 'Overriding of all its variables', 'Serialization of the class'],
      correctIndex: 1,
      explanation: 'A final class cannot be extended or subclassed (e.g., java.lang.String is final).'
    },
    {
      id: 'q-java-3',
      categoryId: 'cat-java',
      questionText: 'Which Java interface must be implemented to allow an object to be sorted using Collections.sort() naturally?',
      options: ['Comparator<T>', 'Comparable<T>', 'Serializable', 'Cloneable'],
      correctIndex: 1,
      explanation: 'Comparable<T> provides the compareTo(T o) method for defining natural ordering of instances.'
    },
    {
      id: 'q-java-4',
      categoryId: 'cat-java',
      questionText: 'What will String s1 = "Java"; String s2 = new String("Java"); System.out.println(s1 == s2); print?',
      options: ['true', 'false', 'Compilation Error', 'NullPointerException'],
      correctIndex: 1,
      explanation: '"==" compares object reference addresses. s1 is in the String Constant Pool while s2 is allocated on the regular heap, so their references differ.'
    },
    {
      id: 'q-java-5',
      categoryId: 'cat-java',
      questionText: 'Which Garbage Collector algorithm was introduced as the default GC in Java 9 onwards?',
      options: ['Serial GC', 'Parallel Old GC', 'G1 (Garbage-First) GC', 'ZGC'],
      correctIndex: 2,
      explanation: 'G1 GC became the default collector starting in JDK 9, replacing Parallel GC.'
    },

    // --- C Programming ---
    {
      id: 'q-c-1',
      categoryId: 'cat-c',
      questionText: 'What does the "sizeof" operator in C evaluate to at runtime or compile-time?',
      options: ['Evaluated at runtime as an int', 'Evaluated at compile-time as a size_t', 'Evaluated at runtime as a float', 'Evaluated at link-time as an unsigned short'],
      correctIndex: 1,
      explanation: 'In C, sizeof is an operator evaluated at compile-time (except for VLAs in C99+) that yields the size in bytes of type size_t.'
    },
    {
      id: 'q-c-2',
      categoryId: 'cat-c',
      questionText: 'Which library function dynamically allocates memory and initializes all allocated bytes to zero?',
      options: ['malloc()', 'realloc()', 'calloc()', 'valloc()'],
      correctIndex: 2,
      explanation: 'calloc(num, size) allocates memory and clears every bit to zero, whereas malloc leaves bytes uninitialized.'
    },
    {
      id: 'q-c-3',
      categoryId: 'cat-c',
      questionText: 'What does a pointer declared as "const int * ptr" signify?',
      options: ['Pointer is constant and cannot point to another address', 'The integer value pointed to cannot be modified via ptr', 'Both the address and value are constant', 'ptr resides in read-only RAM'],
      correctIndex: 1,
      explanation: '"const int * ptr" means ptr points to a const integer; the data cannot be modified through this pointer, but ptr itself can point to another address.'
    },
    {
      id: 'q-c-4',
      categoryId: 'cat-c',
      questionText: 'What is the format specifier used in printf() to print the address of a pointer in hexadecimal format?',
      options: ['%x', '%d', '%p', '%u'],
      correctIndex: 2,
      explanation: '%p is the standard format specifier defined in C to print pointer memory addresses (usually void*).'
    },
    {
      id: 'q-c-5',
      categoryId: 'cat-c',
      questionText: 'What is a "dangling pointer" in C?',
      options: ['A pointer that points to NULL', 'A pointer that points to deallocated / freed memory', 'A pointer that is uninitialized', 'A pointer declared inside a struct'],
      correctIndex: 1,
      explanation: 'A dangling pointer arises when an object is deleted or deallocated without modifying the value of the pointer, leaving it pointing to invalid memory.'
    },

    // --- Python ---
    {
      id: 'q-py-1',
      categoryId: 'cat-python',
      questionText: 'Which of the following built-in data types in Python is IMMUTABLE?',
      options: ['list', 'dict', 'set', 'tuple'],
      correctIndex: 3,
      explanation: 'Tuples are immutable sequences in Python; their elements cannot be modified, added, or removed after creation.'
    },
    {
      id: 'q-py-2',
      categoryId: 'cat-python',
      questionText: 'What is the output of [x**2 for x in range(5) if x % 2 == 1]?',
      options: ['[1, 9]', '[1, 4, 9]', '[0, 2, 4]', '[1, 9, 25]'],
      correctIndex: 0,
      explanation: 'range(5) gives 0, 1, 2, 3, 4. The odd numbers are 1 and 3. Their squares are 1^2 = 1 and 3^2 = 9. So [1, 9].'
    },
    {
      id: 'q-py-3',
      categoryId: 'cat-python',
      questionText: 'What does the Global Interpreter Lock (GIL) in CPython primarily do?',
      options: ['Prevents multiple processes from running', 'Ensures only one native thread executes Python bytecode at a time', 'Compresses memory usage across packages', 'Secures network sockets from race conditions'],
      correctIndex: 1,
      explanation: 'The GIL is a mutex that prevents multiple OS threads from executing CPython bytecodes simultaneously, safeguarding memory management.'
    },
    {
      id: 'q-py-4',
      categoryId: 'cat-python',
      questionText: 'Which keyword is used in a Python function to turn it into a Generator that yields values lazily?',
      options: ['return', 'yield', 'generator', 'produce'],
      correctIndex: 1,
      explanation: 'The "yield" statement pauses function execution and returns a value to the caller, resuming state on subsequent next() calls.'
    },
    {
      id: 'q-py-5',
      categoryId: 'cat-python',
      questionText: 'What is the result of bool("False") in Python?',
      options: ['False', 'True', 'TypeError', 'None'],
      correctIndex: 1,
      explanation: 'Non-empty strings evaluate to True in Python boolean context, regardless of the word inside.'
    },

    // --- Web Development ---
    {
      id: 'q-web-1',
      categoryId: 'cat-webdev',
      questionText: 'In CSS specificity calculations, which selector has the highest specificity weight?',
      options: ['Class selector (.btn)', 'Element selector (div)', 'ID selector (#header)', 'Pseudo-class selector (:hover)'],
      correctIndex: 2,
      explanation: 'An ID selector (0,1,0,0) outweighs class selectors (0,0,1,0) and element selectors (0,0,0,1).'
    },
    {
      id: 'q-web-2',
      categoryId: 'cat-webdev',
      questionText: 'Which HTTP status code signifies that a requested resource was "Moved Permanently"?',
      options: ['301', '302', '304', '404'],
      correctIndex: 0,
      explanation: 'HTTP 301 indicates Moved Permanently, causing browsers and search engines to update their bookmarks and indexing.'
    },
    {
      id: 'q-web-3',
      categoryId: 'cat-webdev',
      questionText: 'In JavaScript event loop mechanics, which queue takes priority right after the current call stack clears?',
      options: ['Macrotask Queue (e.g. setTimeout)', 'Microtask Queue (e.g. Promise.then, queueMicrotask)', 'RequestAnimationFrame queue', 'I/O Polling queue'],
      correctIndex: 1,
      explanation: 'Microtasks (Promises, MutationObserver) are always drained completely before the event loop executes the next macrotask (setTimeout/setInterval).'
    },
    {
      id: 'q-web-4',
      categoryId: 'cat-webdev',
      questionText: 'What does the CSS property "box-sizing: border-box" do?',
      options: ['Adds an extra border outside the margin', 'Includes padding and border within the element\'s specified width and height', 'Prevents margins from collapsing', 'Automatically centers flex children'],
      correctIndex: 1,
      explanation: 'With border-box, the width and height properties include content, padding, and border, preventing unexpected box expansion.'
    },
    {
      id: 'q-web-5',
      categoryId: 'cat-webdev',
      questionText: 'Which web API provides asynchronous HTTP requests with native Promise support, replacing XMLHttpRequest?',
      options: ['Axios API', 'Fetch API', 'Socket API', 'Worker API'],
      correctIndex: 1,
      explanation: 'The standard browser Fetch API (fetch()) provides a modern, promise-based interface for fetching resources across the network.'
    }
  ],
  attempts: [
    // Alex Mercer took Java twice (attempts 1 and 2) -> reached max attempts!
    {
      id: 'att-101',
      userId: 'user-2',
      userName: 'Alex Mercer',
      userEmail: 'alex@example.com',
      categoryId: 'cat-java',
      categoryName: 'Java Programming',
      attemptNumber: 1,
      score: 3,
      totalQuestions: 5,
      percentage: 60,
      passed: true,
      timestamp: '2026-10-06T11:20:00.000Z',
      answers: [
        { questionId: 'q-java-1', selectedOption: 2, correctOption: 2, isCorrect: true },
        { questionId: 'q-java-2', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-java-3', selectedOption: 0, correctOption: 1, isCorrect: false },
        { questionId: 'q-java-4', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-java-5', selectedOption: 1, correctOption: 2, isCorrect: false }
      ]
    },
    {
      id: 'att-102',
      userId: 'user-2',
      userName: 'Alex Mercer',
      userEmail: 'alex@example.com',
      categoryId: 'cat-java',
      categoryName: 'Java Programming',
      attemptNumber: 2,
      score: 4,
      totalQuestions: 5,
      percentage: 80,
      passed: true,
      timestamp: '2026-10-07T14:45:00.000Z',
      answers: [
        { questionId: 'q-java-1', selectedOption: 2, correctOption: 2, isCorrect: true },
        { questionId: 'q-java-2', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-java-3', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-java-4', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-java-5', selectedOption: 0, correctOption: 2, isCorrect: false }
      ]
    },
    // Priya Sharma took Web Dev once
    {
      id: 'att-103',
      userId: 'user-3',
      userName: 'Priya Sharma',
      userEmail: 'priya@example.com',
      categoryId: 'cat-webdev',
      categoryName: 'Web Development',
      attemptNumber: 1,
      score: 5,
      totalQuestions: 5,
      percentage: 100,
      passed: true,
      timestamp: '2026-10-07T16:10:00.000Z',
      answers: [
        { questionId: 'q-web-1', selectedOption: 2, correctOption: 2, isCorrect: true },
        { questionId: 'q-web-2', selectedOption: 0, correctOption: 0, isCorrect: true },
        { questionId: 'q-web-3', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-web-4', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-web-5', selectedOption: 1, correctOption: 1, isCorrect: true }
      ]
    },
    // Demo User took GK once (Attempt 1)
    {
      id: 'att-104',
      userId: 'user-1',
      userName: 'Demo Student',
      userEmail: 'user@omnix.com',
      categoryId: 'cat-gk',
      categoryName: 'General Knowledge',
      attemptNumber: 1,
      score: 4,
      totalQuestions: 5,
      percentage: 80,
      passed: true,
      timestamp: '2026-10-08T09:15:00.000Z',
      answers: [
        { questionId: 'q-gk-1', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-gk-2', selectedOption: 2, correctOption: 2, isCorrect: true },
        { questionId: 'q-gk-3', selectedOption: 1, correctOption: 1, isCorrect: true },
        { questionId: 'q-gk-4', selectedOption: 2, correctOption: 2, isCorrect: true },
        { questionId: 'q-gk-5', selectedOption: 0, correctOption: 1, isCorrect: false }
      ]
    }
  ]
};

module.exports = seedData;
