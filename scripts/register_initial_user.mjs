import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAVQ3tf6Qu4_9PajpJclZAJjVvRgB4ZE2I",
    authDomain: "super-app25.firebaseapp.com",
    projectId: "super-app25",
    storageBucket: "super-app25.firebasestorage.app",
    messagingSenderId: "810900166273",
    appId: "1:810900166273:web:24b8f055a68c9f0a6b5f80"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const BASE_API = "https://script.google.com/macros/s/AKfycby8x6--ITfvIW7ui6c24reBqzL3LUhqL30hf4-gaJCS0xB0EDPM50TcSji_W-IuNU33/exec";

const USERS_TO_REGISTER = [
    {
        username: "DTUDOVARIEDADES",
        email: "dtudovariedades@eletrosystem.com",
        password: "password123",
        realPassword: "251914",
        docData: {
            username: "DTUDOVARIEDADES",
            nome: "Nubia",
            funcao: "CEO: D'TUDO | Dupão",
            photoUrl: "/users/45692327000100/CD1/adm/nb/img/profile_photo.jpg",
            api_config: {
                PAGINA_1: `${BASE_API}?pagina=1`,
                PAGINA_2: `${BASE_API}?pagina=2`,
                PAGINA_3: `${BASE_API}?pagina=3`,
                BILLS: "https://script.google.com/macros/s/AKfycbzkAs8dsJMepkQBhdL--XwO3wUQuQgvA-DFPEwraiz8ijiX9gkPMBuAeM5udQjzmJvzqQ/exec?action=getContas",
                NFCE: "https://script.google.com/macros/s/AKfycbzB7dluoiNyJ4XK6oDK_iyuKZfwPTAJa4ua4RetQsUX9cMObgE-k_tFGI82HxW_OyMf/exec"
            },
            permissions: {
                graphs: true,
                shortcuts: true,
                specific_pages: []
            }
        }
    },
    {
        username: "LAPINHA",
        email: "lapinha@eletrosystem.com",
        password: "password123",
        realPassword: "lapinha123",
        docData: {
            username: "LAPINHA",
            nome: "Lapinha",
            funcao: "Administradora",
            photoUrl: "/users/lapinha/img/profile_photo.jpg",
            api_config: {
                PAGINA_1: `${BASE_API}?pagina=4`,
                PAGINA_2: "", // Disabled: Resumo Operacional
                PAGINA_3: "", // Disabled
                BILLS: "",    // Disabled: Prestes a Vencer
                NFCE: ""      // Disabled
            },
            permissions: {
                graphs: false,
                shortcuts: true,
                specific_pages: []
            }
        }
    }
];

async function register() {
    for (const user of USERS_TO_REGISTER) {
        console.log(`Registering user: ${user.username}...`);
        try {
            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(auth, user.email, user.realPassword);
                console.log(`User ${user.username} created in Auth.`);
            } catch (authError) {
                if (authError.code === 'auth/email-already-in-use') {
                    console.log(`User ${user.username} already exists, signing in to update Firestore...`);
                    try {
                        userCredential = await signInWithEmailAndPassword(auth, user.email, user.realPassword);
                    } catch (signInError) {
                        console.error(`Could not sign in as ${user.username}. Password might differ.`, signInError);
                        continue;
                    }
                } else {
                    throw authError;
                }
            }

            if (userCredential) {
                const uid = userCredential.user.uid;
                console.log(`UID: ${uid}`);
                await setDoc(doc(db, "app", "users", "accounts", uid), user.docData);
                console.log(`User data for ${user.username} written to Firestore.`);
            }

        } catch (e) {
            console.error(`Error registering ${user.username}:`, e);
        }
    }
    process.exit();
}

register();
