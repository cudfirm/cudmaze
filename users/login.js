// login.js

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {

    // --- Elements ---
    const loginModal = document.getElementById('login');
    const showModalBtn = document.getElementById('see');
    const closeModalBtn = document.getElementById('blank');
    const backdrop = document.getElementById('login-backdrop');
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // --- Modal Logic ---
    
    // Function to show the modal
    function showLoginModal() {
        backdrop.classList.add('visible');
        loginModal.classList.add('visible');
        showModalBtn.style.display = 'none'; // Hide the main login button
    }

    // Function to hide the modal
    function hideLoginModal() {
        backdrop.classList.remove('visible');
        loginModal.classList.remove('visible');
        showModalBtn.style.display = 'inline-block'; // Show the main login button
        loginForm.classList.remove('was-validated'); // Reset validation state on close
        loginForm.reset(); // Clear form fields
    }

    // Event Listeners for modal
    // Note: The `str()` function is called directly from the HTML `onclick` attribute
    // but we also add listeners for the close button.
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideLoginModal);
    }
    if (backdrop) {
        backdrop.addEventListener('click', hideLoginModal); // Close modal if backdrop is clicked
    }
    
    // Make the original `str` function available globally for the inline onclick
    window.str = showLoginModal;


    // --- Form Validation Logic ---
    
    // Regular expressions for validation
    const usernameRegex = /^(?![0-9])[a-zA-Z0-9_]{3,20}$/;
    const passwordRegex = /^.{8,32}$/;

    // Function to validate an individual input
    const validateInput = (input, regex) => {
        if (regex.test(input.value)) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
            return true;
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            return false;
        }
    };

    // Add real-time validation feedback as user types
    usernameInput.addEventListener('input', () => validateInput(usernameInput, usernameRegex));
    passwordInput.addEventListener('input', () => validateInput(passwordInput, passwordRegex));

    // Handle form submission
    loginForm.addEventListener('submit', function(event) {
        // Prevent the form from submitting the traditional way
        event.preventDefault();
        event.stopPropagation();

        // Manually validate both fields on submit
        const isUsernameValid = validateInput(usernameInput, usernameRegex);
        const isPasswordValid = validateInput(passwordInput, passwordRegex);

        // Add 'was-validated' class to show feedback
        loginForm.classList.add('was-validated');

        // If both are valid, proceed
        if (isUsernameValid && isPasswordValid) {
            console.log('Form is valid. Submitting...');
            alert('Login successful!');
            // Here you would typically send the data to a server
            // For now, we'll just close the modal
            hideLoginModal();
        } else {
            console.log('Form is invalid.');
        }
    });
});
