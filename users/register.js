// register.js

document.addEventListener('DOMContentLoaded', function() {

    // --- Elements ---
    const backdrop = document.getElementById('modal-backdrop');
    const showTermsBtn = document.getElementById('see');

    // Terms Modal Elements
    const termsModal = document.getElementById('terms-modal');
    const acceptTermsBtn = document.getElementById('accept-terms');

    // Register Modal Elements
    const registerModal = document.getElementById('register-modal');
    const registerForm = document.getElementById('registerForm');
    
    // Universal Close Buttons
    const closeButtons = document.querySelectorAll('.close-modal');

    // --- Modal Logic ---
    function showModal(modal) {
        backdrop.classList.add('visible');
        modal.classList.add('visible');
    }

    function hideModal(modal) {
        backdrop.classList.remove('visible');
        modal.classList.remove('visible');
    }
    
    // Event Listeners
    showTermsBtn.addEventListener('click', () => showModal(termsModal));

    acceptTermsBtn.addEventListener('click', () => {
        hideModal(termsModal);
        showModal(registerModal);
    });
    
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            hideModal(termsModal);
            hideModal(registerModal);
        });
    });

    backdrop.addEventListener('click', () => {
        hideModal(termsModal);
        hideModal(registerModal);
    });

    // --- Form Validation Logic ---
    const username = document.getElementById('username');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm-password');
    const mobile = document.getElementById('mobile');
    
    const usernameRegex = /^(?![0-9])[a-zA-Z0-9_]{3,20}$/;
    const passwordRegex = /^.{8,32}$/;
    const mobileRegex = /^\+?\d{7,15}$/;

    function validateInput(input, regex) {
        if (regex.test(input.value)) {
            input.classList.remove('is-invalid');
            return true;
        } else {
            input.classList.add('is-invalid');
            return false;
        }
    }

    function checkPasswordMatch() {
        if (password.value === confirmPassword.value && confirmPassword.value.length > 0) {
            confirmPassword.classList.remove('is-invalid');
            return true;
        } else {
            confirmPassword.classList.add('is-invalid');
            return false;
        }
    }
    
    // Real-time validation listeners
    username.addEventListener('input', () => validateInput(username, usernameRegex));
    password.addEventListener('input', () => {
        validateInput(password, passwordRegex);
        checkPasswordMatch(); // Check match whenever password changes
    });
    confirmPassword.addEventListener('input', checkPasswordMatch);
    mobile.addEventListener('input', () => validateInput(mobile, mobileRegex));

    // Form submission handler
    registerForm.addEventListener('submit', function(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const isUsernameValid = validateInput(username, usernameRegex);
        const isPasswordValid = validateInput(password, passwordRegex);
        const isMobileValid = validateInput(mobile, mobileRegex);
        const doPasswordsMatch = checkPasswordMatch();

        registerForm.classList.add('was-validated'); // Show feedback for all fields

        if (isUsernameValid && isPasswordValid && isMobileValid && doPasswordsMatch) {
            alert('Registration Successful!');
            // Here you would send data to a server
            hideModal(registerModal);
            registerForm.reset();
            registerForm.classList.remove('was-validated');
        } else {
            console.log('Form is invalid.');
        }
    });
    
    // Show/hide password functionality
    const showPasswordBtn = document.getElementById('show-password');
    showPasswordBtn.addEventListener('click', () => {
        const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
        password.setAttribute('type', type);
        confirmPassword.setAttribute('type', type);
        // Toggle eye icon
        showPasswordBtn.querySelector('i').classList.toggle('fa-eye');
        showPasswordBtn.querySelector('i').classList.toggle('fa-eye-slash');
    });
});
