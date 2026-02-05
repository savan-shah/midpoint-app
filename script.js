let map;
let geocoder;
let midpointMarker;
let markerA;
let markerB;
let infoWindow;
// Store selected places
let selectedPlaceA = null;
let selectedPlaceB = null;

const AuthService = {
    // Keys for localStorage
    USERS_KEY: 'midpoint_users',
    CURRENT_USER_KEY: 'midpoint_current_user',

    // Get all registered users
    getUsers() {
        const users = localStorage.getItem(this.USERS_KEY);
        return users ? JSON.parse(users) : {};
    },

    // Get currently logged in user
    getCurrentUser() {
        return localStorage.getItem(this.CURRENT_USER_KEY);
    },

    // Get user data by email
    getUser(email) {
        const users = this.getUsers();
        return users[email] || null;
    },

    // Save a meeting for the current user
    saveMeeting(meetingData) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in." };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        if (!user.savedMeetings) {
            user.savedMeetings = [];
        }

        // Add timestamp
        meetingData.savedAt = new Date().toISOString();
        user.savedMeetings.push(meetingData);

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Get saved meetings
    getSavedMeetings() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return [];
        const users = this.getUsers();
        return users[currentUserEmail].savedMeetings || [];
    },

    // Save Location (Home/Work)
    saveLocation(alias, address) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in." };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        if (!user.locations) {
            user.locations = [];
        }

        // Remove existing with same alias if exists
        user.locations = user.locations.filter(l => l.alias !== alias);

        user.locations.push({ alias, address });

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Get Locations
    getLocations() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return [];
        const users = this.getUsers();
        return (users[currentUserEmail] && users[currentUserEmail].locations) ? users[currentUserEmail].locations : [];
    },

    // Delete Location
    deleteLocation(alias) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return;

        const users = this.getUsers();
        const user = users[currentUserEmail];
        if (!user.locations) return;

        user.locations = user.locations.filter(l => l.alias !== alias);
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Reorder Location
    reorderLocation(fromIndex, toIndex) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return;

        const users = this.getUsers();
        const user = users[currentUserEmail];
        if (!user.locations) return;

        // Remove from old index
        const [movedItem] = user.locations.splice(fromIndex, 1);

        // Insert at new index
        user.locations.splice(toIndex, 0, movedItem);

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Rename Location
    renameLocation(index, newAlias) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in" };

        const users = this.getUsers();
        const user = users[currentUserEmail];
        if (!user.locations) return { success: false, message: "No locations found" };

        if (index < 0 || index >= user.locations.length) return { success: false, message: "Invalid index" };

        // Check for duplicate alias (excluding self)
        const duplicate = user.locations.some((loc, i) => i !== index && loc.alias.toLowerCase() === newAlias.toLowerCase());
        if (duplicate) {
            return { success: false, message: "Location name already exists." };
        }

        user.locations[index].alias = newAlias;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Add to History (Auto-Log)
    addToHistory(entry) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return;

        const users = this.getUsers();
        const user = users[currentUserEmail];

        if (!user.history) {
            user.history = [];
        }

        // Add to beginning
        user.history.unshift(entry);

        // Limit to 20
        if (user.history.length > 20) {
            user.history = user.history.slice(0, 20);
        }

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // Get History
    getHistory() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return [];
        const users = this.getUsers();
        return users[currentUserEmail].history || [];
    },

    // Save Preferences
    savePreferences(prefs) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in." };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        // Safety check - ensure user exists
        if (!user) return { success: false, message: "User profile not found." };

        user.preferences = {
            defaultMode: prefs.defaultMode || '',
            defaultType: prefs.defaultType || '',
            defaultSort: prefs.defaultSort || ''
        };

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    },

    // Get Preferences
    getPreferences() {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return null;
        const users = this.getUsers();
        const user = users[currentUserEmail];
        return user.preferences || null;
    },



    // Sign Up
    signUp(email, password, firstName, lastName) {
        const users = this.getUsers();
        if (users[email]) {
            return { success: false, message: "User already exists." };
        }
        users[email] = {
            password: password,
            firstName: firstName || '',
            lastName: lastName || ''
        };
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        this.login(email, password);
        return { success: true };
    },

    // Login
    login(email, password) {
        const users = this.getUsers();
        const user = users[email];
        if (user && user.password === password) {
            localStorage.setItem(this.CURRENT_USER_KEY, email);
            return { success: true };
        }
        return { success: false, message: "Invalid email or password." };
    },

    // Logout
    logout() {
        localStorage.removeItem(this.CURRENT_USER_KEY);
    },

    // Update Profile
    updateProfile(data) {
        const currentUserEmail = this.getCurrentUser();
        if (!currentUserEmail) return { success: false, message: "Not logged in" };

        const users = this.getUsers();
        const user = users[currentUserEmail];

        // Update fields if provided
        if (data.firstName !== undefined) user.firstName = data.firstName;
        if (data.lastName !== undefined) user.lastName = data.lastName;
        if (data.city !== undefined) user.city = data.city;
        if (data.phone !== undefined) user.phone = data.phone;
        if (data.profilePic !== undefined) user.profilePic = data.profilePic;

        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        return { success: true };
    }
};

// Auth State
let isLoginMode = true;

// UI Helpers
function toggleAuthModal() {
    const modal = document.getElementById('authModal');
    modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
    // Reset to login mode when opening
    if (modal.style.display === 'block') {
        isLoginMode = true;
        updateModalText();
    }
}

function switchAuthMode() {
    isLoginMode = !isLoginMode;
    updateModalText();
}

function updateModalText() {
    document.getElementById('modalTitle').innerText = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('nameFields').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('authToggleText').innerHTML = isLoginMode
        ? 'Need an account? <a href="#" onclick="switchAuthMode()">Sign Up</a>'
        : 'Already have an account? <a href="#" onclick="switchAuthMode()">Login</a>';
}

function handleAuth() {
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const firstName = document.getElementById('authFirstName').value;
    const lastName = document.getElementById('authLastName').value;

    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }

    // Check names if signing up
    if (!isLoginMode && (!firstName || !lastName)) {
        alert("Please enter your name.");
        return;
    }

    let result;
    if (isLoginMode) {
        result = AuthService.login(email, password);
    } else {
        result = AuthService.signUp(email, password, firstName, lastName);
    }

    if (result.success) {
        toggleAuthModal();
        updateAuthUI();
        // Clear form
        document.getElementById('authEmail').value = '';
        document.getElementById('authPassword').value = '';
    } else {
        alert(result.message);
    }
}

function logout() {
    AuthService.logout();
    updateAuthUI();
}

function updateAuthUI() {
    const currentUserEmail = AuthService.getCurrentUser();
    const loginBtn = document.getElementById('loginBtn');
    const userDisplay = document.getElementById('userDisplay');
    const welcomeMsg = document.getElementById('welcomeMsg');

    if (currentUserEmail) {
        // Try to get full user object to show name
        const userObj = AuthService.getUser(currentUserEmail);
        const displayName = (userObj && userObj.firstName) ? userObj.firstName : currentUserEmail;

        loginBtn.style.display = 'none';
        userDisplay.style.display = 'block';
        welcomeMsg.innerText = `Welcome, ${displayName}`;

        // Show chips
        renderLocationChips();

        // Apply Preferences
        // Apply Preferences
        applyUserPreferences();


    } else {
        loginBtn.style.display = 'block';
        userDisplay.style.display = 'none';
        // Clear chips
        document.getElementById('chipsA').innerHTML = '';
        document.getElementById('chipsB').innerHTML = '';
    }
}

function renderLocationChips() {
    const locations = AuthService.getLocations();
    const chipsA = document.getElementById('chipsA');
    const chipsB = document.getElementById('chipsB');

    if (!chipsA || !chipsB) return;

    let html = '';
    locations.forEach(l => {
        html += `<button onclick="fillAddress(this, '${l.address}')" style="font-size: 0.8em; margin-right: 5px; padding: 2px 5px;">${l.alias}</button>`;
    });

    chipsA.innerHTML = html ? 'Quick Select: ' + html : '';
    chipsB.innerHTML = html ? 'Quick Select: ' + html : '';
}

function fillAddress(btn, address) {
    // Determine which input to fill based on parent container
    const isA = btn.parentElement.id === 'chipsA';
    const inputId = isA ? 'addressA' : 'addressB';
    const el = document.getElementById(inputId);
    if (el) el.value = address;
}

window.fillAddress = fillAddress;

// Expose to window for HTML onClick handlers
window.toggleAuthModal = toggleAuthModal;
window.switchAuthMode = switchAuthMode;

// Profile & Locations Helpers
function toggleProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
        isEditingProfile = false; // Reset state
    } else {
        const userEmail = AuthService.getCurrentUser();
        const user = AuthService.getUser(userEmail);
        if (user) {
            // Render My Info Section
            renderMyInfo();

            // Allow managing preferences (load current)
            applyUserPreferences();

            // Render Locations
            renderManageLocations();
        }
        modal.style.display = 'block';
    }
}

// My Info State & Rendering
let isEditingProfile = false;

function renderMyInfo() {
    const container = document.getElementById('myInfoContainer');
    const userEmail = AuthService.getCurrentUser();
    const user = AuthService.getUser(userEmail);
    if (!user) return;

    if (!isEditingProfile) {
        // View Mode
        const picHtml = user.profilePic
            ? `<img src="${user.profilePic}" class="profile-pic" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 15px;">`
            : `<div style="width: 80px; height: 80px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 2em; margin-bottom: 15px;">👤</div>`;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; position: relative;">
                ${picHtml}
                
                <div style="width: 100%;">
                     <!-- Header and Edit Button Wrapper -->
                     <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0;">👤 My Info</h3>
                        <button onclick="handleProfileEditToggle()" title="Edit Profile" 
                            style="background: transparent; border: none; font-size: 1.2em; cursor: pointer; padding: 5px; transition: transform 0.1s;">
                            ✏️
                        </button>
                    </div>
                </div>
               
                <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; width: 100%; box-sizing: border-box;">
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
                    <p style="margin: 5px 0;"><strong>Phone:</strong> ${user.phone || '<span style="color: #999;">Not set</span>'}</p>
                    <p style="margin: 5px 0;"><strong>City:</strong> ${user.city || '<span style="color: #999;">Not set</span>'}</p>
                </div>
            </div>
        `;
    } else {
        // Edit Mode
        const picReview = user.profilePic
            ? `<img id="previewPic" src="${user.profilePic}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-right: 10px;">`
            : '';

        container.innerHTML = `
             <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
                <h3 style="margin-top: 0;">Edit Info</h3>
                
                <div style="margin-bottom: 10px; display: flex; align-items: center;">
                    ${picReview}
                    <input type="file" id="editProfilePic" accept="image/*">
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 0.8em; margin-bottom: 2px;">First Name</label>
                        <input type="text" id="editFirstName" value="${user.firstName}" style="width: 100%; box-sizing: border-box;">
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 0.8em; margin-bottom: 2px;">Last Name</label>
                         <input type="text" id="editLastName" value="${user.lastName}" style="width: 100%; box-sizing: border-box;">
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 0.8em; margin-bottom: 2px;">City</label>
                    <input type="text" id="editCity" value="${user.city || ''}" style="width: 100%; box-sizing: border-box;" placeholder="e.g. San Francisco">
                </div>

                 <div style="margin-bottom: 10px;">
                    <label style="display: block; font-size: 0.8em; margin-bottom: 2px;">Phone</label>
                    <input type="tel" id="editPhone" value="${user.phone || ''}" style="width: 100%; box-sizing: border-box;" placeholder="e.g. 555-0123">
                </div>

                <div style="text-align: right;">
                    <button onclick="handleProfileEditToggle()" style="background: #ccc; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Cancel</button>
                    <button onclick="handleProfileSave()" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Save Changes</button>
                </div>
             </div>
        `;

        // Attach Enter triggers to new inputs
        setTimeout(() => {
            addEnterTrigger('editFirstName', handleProfileSave);
            addEnterTrigger('editLastName', handleProfileSave);
            addEnterTrigger('editCity', handleProfileSave);
            addEnterTrigger('editPhone', handleProfileSave);
        }, 0);
    }
}

function handleProfileEditToggle() {
    isEditingProfile = !isEditingProfile;
    renderMyInfo();
}

async function handleProfileSave() {
    const firstName = document.getElementById('editFirstName').value;
    const lastName = document.getElementById('editLastName').value;
    const city = document.getElementById('editCity').value;
    const phone = document.getElementById('editPhone').value;
    const fileInput = document.getElementById('editProfilePic');

    let profilePic = null;

    // Check if image updated
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            profilePic = await resizeImage(fileInput.files[0]);
        } catch (e) {
            alert("Error processing image: " + e);
            return;
        }
    }

    const data = { firstName, lastName, city, phone };
    if (profilePic) {
        data.profilePic = profilePic;
    }

    const result = AuthService.updateProfile(data);
    if (result.success) {
        isEditingProfile = false;
        renderMyInfo();
        // Also update welcome message in main UI
        updateAuthUI();
    } else {
        alert(result.message);
    }
}

// Image Resizer Helper
function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 150;
                const MAX_HEIGHT = 150;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Return Base64
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Render the list inside the Profile modal dealing with deletions
function renderManageLocations() {
    const listDiv = document.getElementById('locationsList');
    const locations = AuthService.getLocations();

    if (locations.length === 0) {
        listDiv.innerHTML = '<p>No saved locations.</p>';
        return;
    }

    listDiv.innerHTML = locations.map(loc => `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; padding: 5px; background: #f9f9f9; border-radius: 3px;">
            <div>
                <strong>${loc.alias}</strong>: ${loc.address}
            </div>
            <button onclick="handleDeleteLocation('${loc.alias}')" style="background: #ffdddd; border: none; padding: 2px 5px; cursor: pointer;">🗑️</button>
        </div>
    `).join('');
}

function handleAddLocation() {
    const aliasInput = document.getElementById('newLocAlias');
    const addressInput = document.getElementById('newLocAddress');
    const alias = aliasInput.value.trim();
    const address = addressInput.value.trim(); // Note: gmp-place-autocomplete value might differ, but for text input use default
    // For gmp-place-autocomplete, we might need a better way if value isn't enough, but usually .value gets text

    if (!alias || !address) {
        alert("Please enter a name and address.");
        return;
    }

    const result = AuthService.saveLocation(alias, address);
    if (result.success) {
        aliasInput.value = '';
        addressInput.value = '';
        renderManageLocations();
        renderLocationChips(); // Update main UI
    } else {
        alert(result.message);
    }
}

function handleDeleteLocation(alias) {
    if (confirm(`Delete location "${alias}"?`)) {
        AuthService.deleteLocation(alias);
        renderManageLocations();
        renderLocationChips();
    }
}

// Helper to get emoji based on location alias
function getLocationEmoji(alias) {
    const lower = alias.toLowerCase();
    if (lower.includes('home')) return '🏠';
    if (lower.includes('work') || lower.includes('office')) return '🏢';
    if (lower.includes('gym') || lower.includes('fitness')) return '🏋️';
    if (lower.includes('school') || lower.includes('university') || lower.includes('college')) return '🎓';
    if (lower.includes('bar') || lower.includes('pub') || lower.includes('brewery')) return '🍺';
    if (lower.includes('coffee') || lower.includes('cafe')) return '☕';
    if (lower.includes('park')) return '🌳';
    if (lower.includes('shop') || lower.includes('store') || lower.includes('mall') || lower.includes('market')) return '🛍️';
    if (lower.includes('doctor') || lower.includes('hospital') || lower.includes('clinic')) return '🏥';
    if (lower.includes('restaurant') || lower.includes('diner') || lower.includes('food')) return '🍽️';
    return '📍';
}

// Render chips on the main screen
function renderLocationChips() {
    const locations = AuthService.getLocations();
    const chipsA = document.getElementById('chipsA');
    const chipsB = document.getElementById('chipsB');

    if (!chipsA || !chipsB) return;

    chipsA.innerHTML = locations.map(loc => {
        const emoji = getLocationEmoji(loc.alias);
        return `<button type="button" onclick="setAddress('addressA', '${loc.address.replace(/'/g, "\\'")}')" 
        style="padding: 2px 8px; margin-right: 5px; border-radius: 12px; border: 1px solid #ddd; background: #f0f0f0; cursor: pointer; font-size: 0.9em;">
        ${emoji} ${loc.alias}
        </button>`;
    }).join('');

    chipsB.innerHTML = locations.map(loc => {
        const emoji = getLocationEmoji(loc.alias);
        return `<button type="button" onclick="setAddress('addressB', '${loc.address.replace(/'/g, "\\'")}')" 
        style="padding: 2px 8px; margin-right: 5px; border-radius: 12px; border: 1px solid #ddd; background: #f0f0f0; cursor: pointer; font-size: 0.9em;">
        ${emoji} ${loc.alias}
        </button>`;
    }).join('');
}

function setAddress(elementId, address) {
    const el = document.getElementById(elementId);
    if (el) {
        el.value = address;
    }
}

// Handle Save Preferences
function handleSavePreferences() {
    const defaultMode = document.getElementById('prefDefaultMode').value;
    const defaultType = document.getElementById('prefDefaultType').value;
    const defaultSort = document.getElementById('prefDefaultSort').value;

    console.log('Saving preferences:', { defaultMode, defaultType, defaultSort });
    console.log('Current user:', AuthService.getCurrentUser());

    const result = AuthService.savePreferences({
        defaultMode: defaultMode,
        defaultType: defaultType,
        defaultSort: defaultSort
    });

    console.log('Save result:', result);

    if (result && result.success) {
        alert('Preferences saved!');
        // Apply to current form
        applyPreferences();
    } else {
        alert(result?.message || 'Failed to save preferences. Please make sure you are logged in.');
    }
}

// Load and apply user preferences to form
function applyPreferences() {
    const prefs = AuthService.getPreferences();
    if (!prefs) return;

    // Apply to search form
    if (prefs.defaultMode) {
        document.getElementById('modeA').value = prefs.defaultMode;
        document.getElementById('modeB').value = prefs.defaultMode;
    }
    if (prefs.defaultType) {
        document.getElementById('placeType').value = prefs.defaultType;
    }
    if (prefs.defaultSort) {
        document.getElementById('sortPreference').value = prefs.defaultSort;
    }

    // Apply to preferences form (for display)
    const prefModeEl = document.getElementById('prefDefaultMode');
    const prefTypeEl = document.getElementById('prefDefaultType');
    const prefSortEl = document.getElementById('prefDefaultSort');

    if (prefModeEl && prefs.defaultMode) prefModeEl.value = prefs.defaultMode;
    if (prefTypeEl && prefs.defaultType) prefTypeEl.value = prefs.defaultType;
    if (prefSortEl && prefs.defaultSort) prefSortEl.value = prefs.defaultSort;
}

// Expose functions
window.toggleProfileModal = toggleProfileModal;
window.handleAddLocation = handleAddLocation;
window.handleDeleteLocation = handleDeleteLocation;
window.setAddress = setAddress;
window.handleSavePreferences = handleSavePreferences;

let editingLocationIndex = null;

function renderManageLocations() {
    const listDiv = document.getElementById('locationsList');
    const locations = AuthService.getLocations();

    if (locations.length === 0) {
        listDiv.innerHTML = '<p>No saved locations.</p>';
        return;
    }

    listDiv.innerHTML = locations.map((loc, index) => {
        // Edit Mode
        if (editingLocationIndex === index) {
            return `
            <div style="margin-bottom: 5px; padding: 10px; background: #eef; border-radius: 3px;">
                <input type="text" id="editAliasInput" value="${loc.alias}" style="width: 120px;">
                <button onclick="handleSaveRename(${index})" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer; margin-left: 5px;">Save</button>
                <button onclick="handleCancelEdit()" style="background: #ccc; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">Cancel</button>
            </div>`;
        }

        // View Mode
        const emoji = getLocationEmoji(loc.alias);
        return `
        <div 
            class="location-item"
            draggable="true" 
            ondragstart="handleDragStart(event, ${index})" 
            ondragover="handleDragOver(event)" 
            ondragleave="handleDragLeave(event)"
            ondrop="handleDrop(event, ${index})"
            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; padding: 10px; background: #f9f9f9; border-radius: 3px; cursor: grab;">
            <div>
                <strong>${emoji} ${loc.alias}</strong>: ${loc.address}
            </div>
            <div>
                <button onclick="handleEditMode(${index})" style="background: transparent; border: 1px solid #ccc; padding: 2px 5px; cursor: pointer; margin-right: 5px; border-radius: 3px;">✏️</button>
                <button onclick="handleDeleteLocation('${loc.alias}')" style="background: #ffdddd; border: none; padding: 2px 5px; cursor: pointer; border-radius: 3px;">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function handleEditMode(index) {
    editingLocationIndex = index;
    renderManageLocations();
}

function handleCancelEdit() {
    editingLocationIndex = null;
    renderManageLocations();
}

function handleSaveRename(index) {
    const input = document.getElementById('editAliasInput');
    const newAlias = input.value.trim();

    if (!newAlias) {
        alert("Name cannot be empty.");
        return;
    }

    const result = AuthService.renameLocation(index, newAlias);
    if (result.success) {
        editingLocationIndex = null;
        renderManageLocations();
        renderLocationChips();
    } else {
        alert(result.message);
    }
}

// Drag and Drop Handlers
let draggedIndex = null;

function handleDragStart(e, index) {
    draggedIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index); // Required for Firefox
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';

    // Add visual cue
    const targetItem = e.target.closest('.location-item');
    if (targetItem && targetItem !== e.target) {
        targetItem.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const targetItem = e.target.closest('.location-item');
    if (targetItem) {
        targetItem.classList.remove('drag-over');
    }
}

function handleDrop(e, targetIndex) {
    e.preventDefault();

    // Clean up visuals
    const items = document.querySelectorAll('.location-item');
    items.forEach(item => {
        item.classList.remove('drag-over');
        item.classList.remove('dragging');
    });

    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        AuthService.reorderLocation(draggedIndex, targetIndex);
        renderManageLocations();
        renderLocationChips();
    }
    draggedIndex = null;
}

// Expose handlers
// Expose handlers
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
// Expose handlers
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleEditMode = handleEditMode;
window.handleCancelEdit = handleCancelEdit;
window.handleSaveRename = handleSaveRename;
window.handleProfileEditToggle = handleProfileEditToggle;
window.handleProfileSave = handleProfileSave;

function handleMoveLocation(index, direction) {
    AuthService.moveLocation(index, direction);
    renderManageLocations();
    renderLocationChips();
}




// Preferences Helpers
function handleSavePreferences() {
    const defaultMode = document.getElementById('prefDefaultMode').value;
    const defaultType = document.getElementById('prefDefaultType').value;

    const result = AuthService.savePreferences({ defaultMode, defaultType });
    if (result.success) {
        alert("Preferences saved!");
        applyUserPreferences();
    } else {
        alert(result.message);
    }
}

function applyUserPreferences() {
    const prefs = AuthService.getPreferences();
    if (prefs) {
        if (prefs.defaultMode !== undefined) {
            const modeA = document.getElementById('modeA');
            const modeB = document.getElementById('modeB');
            // If defaultMode is "" (No Preference), this sets it to "" (Select Mode...)
            // If defaultMode is "DRIVING", sets to "DRIVING"
            if (modeA) modeA.value = prefs.defaultMode;
            if (modeB) modeB.value = prefs.defaultMode;
        }
        if (prefs.defaultType) {
            const el = document.getElementById('placeType');
            if (el) el.value = prefs.defaultType;
        }

        // Also update the Profile Modal inputs
        const prefMode = document.getElementById('prefDefaultMode');
        const prefType = document.getElementById('prefDefaultType');

        if (prefMode && prefs.defaultMode !== undefined) {
            prefMode.value = prefs.defaultMode;
        }
        if (prefType) {
            prefType.value = prefs.defaultType || '';
        }
    }
}

window.handleSavePreferences = handleSavePreferences;
window.handleAddLocation = handleAddLocation;
window.handleDeleteLocation = handleDeleteLocation;
window.handleMoveLocation = handleMoveLocation;

// History UI Helpers
function toggleHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        renderHistory();
        modal.style.display = 'block';
    }
}

function renderHistory() {
    const listDiv = document.getElementById('historyList');
    const history = AuthService.getHistory();

    if (history.length === 0) {
        listDiv.innerHTML = '<p>no history yet.</p>';
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
    history.forEach((h, index) => {
        const date = new Date(h.date).toLocaleDateString();
        // Escape quotes to prevent HTML breaking
        const safeType = h.type.replace(/'/g, "\\'");
        const safeAddrA = h.addrA.replace(/'/g, "\\'");
        const safeAddrB = h.addrB.replace(/'/g, "\\'");

        html += `
        <div onclick="restoreHistorySearch(${index})" 
             style="border: 1px solid #eee; padding: 15px; border-radius: 8px; cursor: pointer; transition: background 0.2s; background: #fff;"
             onmouseover="this.style.background='#f9f9f9'" 
             onmouseout="this.style.background='#fff'">
            <div style="font-size: 0.8em; color: #888; margin-bottom: 5px;">${date}</div>
            <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">${h.type}</div>
            <div style="font-size: 0.9em; color: #555;">
                <span style="font-size: 1.2em;">🅰️</span> ${h.addrA}<br>
                <span style="font-size: 1.2em;">🅱️</span> ${h.addrB}
            </div>
        </div>`;
    });
    html += '</div>';
    listDiv.innerHTML = html;
}

function restoreHistorySearch(index) {
    const history = AuthService.getHistory();
    const item = history[index];
    if (!item) return;

    // Fill inputs
    const elA = document.getElementById('addressA');
    const elB = document.getElementById('addressB');
    const elType = document.getElementById('placeType');

    if (elA) elA.value = item.addrA;
    if (elB) elB.value = item.addrB;
    if (elType) elType.value = item.type;

    // Close modal
    toggleHistoryModal();

    // Trigger search
    // Slight delay to ensure modal closes smoothly first
    setTimeout(() => {
        findMidpoint();
    }, 300);
}

window.toggleHistoryModal = toggleHistoryModal;
window.restoreHistorySearch = restoreHistorySearch;

function initMap() {
    // Initialize the map centered on a default location
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 4,
        center: { lat: 39.8283, lng: -98.5795 }, // Center of US
        mapId: "DEMO_MAP_ID", // Required for Advanced Markers
    });
    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();

    // Check Auth Status on Load (also updates UI which includes chips)
    updateAuthUI();

    // Apply saved preferences (travel mode, place type, prioritization)
    applyPreferences();

    // Listen for place selections
    const autocompleteA = document.getElementById("addressA");
    const autocompleteB = document.getElementById("addressB");

    autocompleteA.addEventListener('gmp-places-place-select', async (event) => {
        selectedPlaceA = event.detail.place;
    });

    autocompleteB.addEventListener('gmp-places-place-select', async (event) => {
        selectedPlaceB = event.detail.place;
    });

    // Check for URL parameters and pre-fill form
    const params = new URLSearchParams(window.location.search);
    if (params.has('addrA')) {
        // For component value (text) fallback
        if (autocompleteA) autocompleteA.value = params.get('addrA');
        if (autocompleteB) autocompleteB.value = params.get('addrB') || '';

        document.getElementById('modeA').value = params.get('modeA') || 'DRIVING';
        document.getElementById('modeB').value = params.get('modeB') || 'DRIVING';
        document.getElementById('placeType').value = params.get('type') || '';
        document.getElementById('sortPreference').value = params.get('sort') || 'FAIRNESS';

        if (params.get('addrB') && params.get('type')) {
            setTimeout(() => findMidpoint(), 800);
        }
    }

    // Enter Key Listeners
    const inputs = [document.getElementById("addressA"), document.getElementById("addressB"), document.getElementById("placeType")];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    // Slight delay to allow autocomplete selection to register if that was the intent
                    setTimeout(() => findMidpoint(), 100);
                }
            });
        }
    });


}

// Generate shareable link
function shareSearch() {
    const addressA = document.getElementById('addressA').value;
    const addressB = document.getElementById('addressB').value;
    const modeA = document.getElementById('modeA').value;
    const modeB = document.getElementById('modeB').value;
    const placeType = document.getElementById('placeType').value;
    const sortPref = document.getElementById('sortPreference').value;

    if (!addressA || !addressB || !placeType) {
        alert('Please fill in both addresses and a place type before sharing.');
        return;
    }

    const params = new URLSearchParams({
        addrA: addressA,
        addrB: addressB,
        modeA: modeA,
        modeB: modeB,
        type: placeType,
        sort: sortPref
    });

    const shareUrl = window.location.origin + window.location.pathname + '?' + params.toString();

    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
        alert('Link copied to clipboard!\\n\\n' + shareUrl);
    }).catch(() => {
        // Fallback: show the URL in a prompt
        prompt('Copy this link:', shareUrl);
    });
}

window.shareSearch = shareSearch;






function findMidpoint() {
    // Try to get values from components (text fallback)
    const elA = document.getElementById("addressA");
    const elB = document.getElementById("addressB");
    const textA = elA.value;
    const textB = elB.value;
    const modeA = document.getElementById("modeA").value;
    const modeB = document.getElementById("modeB").value;

    if (!textA || !textB) {
        alert("Please enter both addresses.");
        return;
    }

    if (!modeA || !modeB) {
        alert("Please select a travel mode for both locations.");
        return;
    }

    const sortPref = document.getElementById("sortPreference").value;
    if (!sortPref) {
        alert("Please select a prioritization type.");
        return;
    }

    // Helper to get location (use selected Place if matches text, or Geocode)
    const getLocation = (element, text, selectedPlace, callback) => {
        // If we have a selected place object and it seems valid
        if (selectedPlace && selectedPlace.location) {
            callback(selectedPlace.location);
            return;
        }

        // Fallback: Geocode the text value
        geocoder.geocode({ address: text }, (results, status) => {
            if (status !== "OK") {
                alert("Geocode was not successful: " + status);
                return;
            }
            callback(results[0].geometry.location);
        });
    };

    getLocation(elA, textA, selectedPlaceA, (locA) => {
        getLocation(elB, textB, selectedPlaceB || null, (locB) => {

            // Calculate Midpoint
            const midLat = (locA.lat() + locB.lat()) / 2;
            const midLng = (locA.lng() + locB.lng()) / 2;
            const midpoint = { lat: midLat, lng: midLng };


            // Clear previous markers
            if (midpointMarker) midpointMarker.map = null;
            if (markerA) markerA.map = null;
            if (markerB) markerB.map = null;

            // Create Pin Elements
            const pinMid = new google.maps.marker.PinElement({ glyphText: "M", background: "#FBBC04", borderColor: "#137333" });
            const pinA = new google.maps.marker.PinElement({ glyphText: "A", background: "#EA4335" });
            const pinB = new google.maps.marker.PinElement({ glyphText: "B", background: "#4285F4" });

            // Add Markers
            midpointMarker = new google.maps.marker.AdvancedMarkerElement({
                position: midpoint,
                map: map,
                title: "Midpoint",
                content: pinMid
            });

            markerA = new google.maps.marker.AdvancedMarkerElement({
                position: locA,
                map: map,
                title: "Location A",
                content: pinA
            });

            markerB = new google.maps.marker.AdvancedMarkerElement({
                position: locB,
                map: map,
                title: "Location B",
                content: pinB
            });

            // Center map
            map.setCenter(midpoint);
            map.setZoom(13); // Zoom in closer to see places

            // Find Places near Midpoint
            findPlaces(midpoint, locA, locB);
        });
    });
}

let placeMarkers = [];

async function findPlaces(midpoint, locA, locB) {
    const type = document.getElementById('placeType').value;
    if (!type) {
        alert("Please enter a place type.");
        return;
    }

    // Calculate distance between A and B (in meters)
    const distanceAB = google.maps.geometry.spherical.computeDistanceBetween(locA, locB);

    // Determine Radius (Auto-calculated)
    let searchRadius = distanceAB / 2;
    searchRadius = Math.max(1000, searchRadius);   // At least 1km
    searchRadius = Math.min(50000, searchRadius);  // At most 50km

    // Clear old place markers
    placeMarkers.forEach(marker => marker.map = null);
    placeMarkers = [];

    // Clear old list results
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<h3>Results:</h3><p>Loading fair transit options...</p>';

    try {
        // Import the new Places library
        const { Place } = await google.maps.importLibrary("places");

        // New API: Place.searchByText (supports free-text queries like "coffee shop")
        const { places } = await Place.searchByText({
            textQuery: type, // e.g., "coffee shop"
            fields: ['displayName', 'location', 'rating', 'userRatingCount', 'formattedAddress'],
            locationBias: {
                center: midpoint,
                radius: searchRadius
            },
            maxResultCount: 10
        });

        if (!places || places.length === 0) {
            resultsDiv.innerHTML = '<p>No places found. Try a different search term.</p>';
            return;
        }

        // Take top 10 (already limited by maxResultCount)
        const limitedResults = places.slice(0, 10);
        const destinations = limitedResults.map(place => place.location);

        // Get selected modes
        const modeA = document.getElementById('modeA').value;
        const modeB = document.getElementById('modeB').value;

        // Map modes to emojis
        const modeEmojis = {
            'TRANSIT': '🚍',
            'DRIVING': '🚗',
            'WALKING': '🚶',
            'BICYCLING': '🚲'
        };

        // Get departure time (if set)
        const departureInput = document.getElementById('departureTime').value;
        let departureTime = null;
        if (departureInput) {
            departureTime = new Date(departureInput);
        } else {
            departureTime = new Date(); // Default to now
        }

        const matrixService = new google.maps.DistanceMatrixService();

        // Helper to wrap DistanceMatrix in a Promise
        const getTimes = (origin, mode) => {
            return new Promise((resolve) => {
                const request = {
                    origins: [origin],
                    destinations: destinations,
                    travelMode: google.maps.TravelMode[mode],
                };

                // Add departure time for transit and driving modes
                const now = new Date();
                if (mode === 'TRANSIT') {
                    request.transitOptions = { departureTime: departureTime };
                } else if (mode === 'DRIVING') {
                    if (departureTime >= now) {
                        request.drivingOptions = { departureTime: departureTime };
                    }
                }

                matrixService.getDistanceMatrix(request, (response, status) => {
                    if (status === "OK") resolve(response.rows[0].elements);
                    else resolve(null);
                });
            });
        };

        // Run requests in parallel
        const [resultsA, resultsB] = await Promise.all([
            getTimes(locA, modeA),
            getTimes(locB, modeB)
        ]);

        if (!resultsA || !resultsB) {
            resultsDiv.innerHTML = '<p style="color: red;">Could not calculate travel times. Please check your departure time (cannot be in the past for Driving) or try a different mode.</p>';
            return;
        }

        // Build array of combined data objects
        const rankedPlaces = limitedResults.map((place, index) => {
            const elemA = resultsA[index];
            const elemB = resultsB[index];
            const valA = elemA.status === "OK" ? elemA.duration.value : Infinity;
            const valB = elemB.status === "OK" ? elemB.duration.value : Infinity;

            // Calculate metrics
            const totalTime = valA + valB;
            let percentDiff = 1.0;
            if (valA !== Infinity && valB !== Infinity) {
                const maxVal = Math.max(valA, valB);
                if (maxVal > 0) percentDiff = Math.abs(valA - valB) / maxVal;
                else percentDiff = 0;
            }

            return {
                place: place,
                valA: valA,
                valB: valB,
                textA: elemA.status === "OK" ? elemA.duration.text : "No route",
                textB: elemB.status === "OK" ? elemB.duration.text : "No route",
                percentDiff: percentDiff,
                totalTime: totalTime
            };
        });

        // Get sort preference
        const sortPref = document.getElementById('sortPreference').value;

        // Sort Results
        rankedPlaces.sort((a, b) => {
            if (sortPref === 'SPEED') {
                if (a.totalTime !== b.totalTime) {
                    return a.totalTime - b.totalTime;
                }
                return a.percentDiff - b.percentDiff;
            } else {
                if (a.percentDiff !== b.percentDiff) {
                    return a.percentDiff - b.percentDiff;
                }
                return a.totalTime - b.totalTime;
            }
        });

        // Render Sorted Results
        let html = `<h3>Results (Sorted by ${sortPref === 'SPEED' ? 'Speed' : 'Fairness'}):</h3>`;
        resultsDiv.innerHTML = html;

        // Store current search data for saving
        window.currentSearchData = {
            addrA: document.getElementById('addressA').value,
            addrB: document.getElementById('addressB').value,
            modeA: modeA,
            modeB: modeB,
            type: document.getElementById('placeType').value,
            sort: sortPref,
            recommendations: rankedPlaces.slice(0, 5).map(p => p.place.displayName)
        };

        // Auto-Add to History (if logged in)
        if (AuthService.getCurrentUser() && rankedPlaces.length > 0) {
            AuthService.addToHistory({
                date: new Date().toISOString(),
                type: document.getElementById('placeType').value,
                addrA: document.getElementById('addressA').value,
                addrB: document.getElementById('addressB').value,
                topResult: rankedPlaces[0].place.displayName
            });
        }

        rankedPlaces.forEach((item, index) => {
            // Create Pin
            const pin = new google.maps.marker.PinElement({
                glyphText: (index + 1).toString(),
                background: "#FFF",
                borderColor: "#000"
            });

            // Create Advanced Marker
            const marker = new google.maps.marker.AdvancedMarkerElement({
                map: map,
                position: item.place.location,
                title: item.place.displayName,
                content: pin
            });
            placeMarkers.push(marker);

            // Add Hover Listener
            marker.content.addEventListener("mouseenter", () => {
                infoWindow.setContent(item.place.displayName);
                infoWindow.open(map, marker);
            });
            marker.content.addEventListener("mouseleave", () => {
                infoWindow.close();
            });

            // Explanation Logic
            let explanation = "";
            if (item.valA === Infinity || item.valB === Infinity) {
                explanation = "🚫 No valid transit route found.";
            } else {
                if (item.percentDiff <= 0.15) {
                    explanation = `✅ <strong>Very Fair!</strong> Travel times are similar.`;
                } else if (item.percentDiff > 0.5) {
                    explanation = `⚠️ Large difference in travel times.`;
                } else {
                    explanation = ``;
                }
            }

            // Build Google Maps Directions URLs
            const destLat = item.place.location.lat();
            const destLng = item.place.location.lng();
            const gmModeA = modeA.toLowerCase();
            const gmModeB = modeB.toLowerCase();
            const urlA = `https://www.google.com/maps/dir/?api=1&origin=${locA.lat()},${locA.lng()}&destination=${destLat},${destLng}&travelmode=${gmModeA}`;
            const urlB = `https://www.google.com/maps/dir/?api=1&origin=${locB.lat()},${locB.lng()}&destination=${destLat},${destLng}&travelmode=${gmModeB}`;

            // Format rating display
            let ratingDisplay = '';
            if (item.place.rating) {
                const reviewCount = item.place.userRatingCount || 0;
                ratingDisplay = `⭐ ${item.place.rating} (${reviewCount} reviews)`;
            } else {
                ratingDisplay = 'No rating';
            }

            // Add to List
            const div = document.createElement('div');
            div.className = 'place-item';

            // Highlight top result
            let topLabel = '';
            if (index === 0) {
                div.style.border = '2px solid #4CAF50';
                div.style.backgroundColor = '#f0fff0';
                topLabel = '<span style="background: #4CAF50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8em;">🏆 best match</span><br>';
            }

            div.innerHTML = `
                ${topLabel}
                <strong>#${index + 1} ${item.place.displayName}</strong> <span style="color: #666; font-size: 0.9em;">${ratingDisplay}</span><br>
                ${item.place.formattedAddress || ''}<br>
                ${modeEmojis[modeA]} A: ${item.textA} <a href="${urlA}" target="_blank">directions</a> | ${modeEmojis[modeB]} B: ${item.textB} <a href="${urlB}" target="_blank">directions</a><br>
                <span style="color: #555; font-size: 0.9em;">${explanation}</span>
            `;
            resultsDiv.appendChild(div);
        });

    } catch (error) {
        console.error("Places API Error:", error);
        resultsDiv.innerHTML = '<p style="color: red;">Error searching for places. Please try again.</p>';
    }
}

// Global scope for the button functionality
window.findMidpoint = findMidpoint;

// Enter Key Shortcuts Helper
function addEnterTrigger(elementId, callback) {
    const el = document.getElementById(elementId);
    if (el) {
        // Use capture: true to catch the event before the web component swallows it
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                callback();
            }
        }, true);
    }
}

// Setup Global Shortcuts
document.addEventListener('DOMContentLoaded', () => {
    // Search Inputs
    addEnterTrigger('addressA', findMidpoint);
    addEnterTrigger('addressB', findMidpoint);
    addEnterTrigger('placeType', findMidpoint);
    addEnterTrigger('departureTime', findMidpoint);

    // Auth Inputs
    addEnterTrigger('authEmail', handleAuth);
    addEnterTrigger('authPassword', handleAuth);
    addEnterTrigger('authFirstName', handleAuth);
    addEnterTrigger('authLastName', handleAuth);

    // Profile/Locations Inputs (Static in Modal)
    addEnterTrigger('prefDefaultType', handleSavePreferences);
    addEnterTrigger('newLocAlias', handleAddLocation);
    // newLocAddress is a gmp-place-autocomplete, might capture enter, but worth trying
    addEnterTrigger('newLocAddress', handleAddLocation);
});
