# IMPORTANTE: ANTES DE RODAR, FECHE TODAS AS JANELAS DO CHROME E 
# FINALIZE OS PROCESSOS NO GERENCIADOR DE TAREFAS (Ctrl+Shift+Esc)

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
from datetime import datetime
import os

# --- INFORMAÇÕES DE ACESSO ---
SEU_USUARIO = "D.TUDO"
SUA_SENHA = "@DTD.4.25@"

# --- CONFIGURAÇÕES ---
LOGIN_URL = "https://sistema.algorix.com/movecard/Login.aspx?op=Login"
download_path = os.path.join(os.path.expanduser("~"), "Downloads")
prefs = {
    "download.default_directory": download_path,
    "plugins.always_open_pdf_externally": True
}
options = uc.ChromeOptions()
options.add_experimental_option("prefs", prefs)

# Apontamos para a pasta principal de dados do Chrome.
# O robô carregará seu perfil padrão automaticamente.
user_profile_path = r"C:\Users\meu computador\AppData\Local\Google\Chrome\User Data"


print("✅ Tudo pronto! Iniciando o robô com o seu perfil padrão do Chrome...")
print("   Certifique-se de que o Chrome está totalmente fechado.")

driver = None

try:
    # A forma correta de passar o perfil é através do argumento 'user_data_dir'
    driver = uc.Chrome(
        options=options,
        user_data_dir=user_profile_path,
        use_subprocess=True
    ) 
    driver.implicitly_wait(15)
    driver.maximize_window()

    # --- PASSO 1: FAZER LOGIN ---
    print("➡️  Acessando a página de login...")
    driver.get(LOGIN_URL)
    time.sleep(7) 

    print("➡️  Preenchendo usuário e senha...")
    user_field = WebDriverWait(driver, 20).until(
        EC.element_to_be_clickable((By.ID, 'ucUsuarioSenha_txtLoginUsuario'))
    )
    user_field.send_keys(SEU_USUARIO)

    driver.find_element(By.ID, 'ucUsuarioSenha_txtSenha').send_keys(SUA_SENHA)
    
    print("➡️  Aguardando a validação do Captcha...")
    WebDriverWait(driver, 30).until(
        lambda d: d.find_element(By.NAME, 'cf-turnstile-response').get_attribute('value') != ''
    )
    print("✅ Captcha validado!")

    print("➡️  Clicando para entrar...")
    driver.find_element(By.ID, 'ucUsuarioSenha_btnLogin').click()

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.ID, "_ctl7_Menu1-menuItem001"))
    )
    print("✅ Login realizado com sucesso!")

    # --- PASSO 2: IR EM RELATÓRIO > MOVIMENTO > EM LOJA ---
    print("➡️  Navegando pelos menus com mais paciência...")
    
    actions = ActionChains(driver)
    time.sleep(2) 

    menu_relatorios = driver.find_element(By.ID, "_ctl7_Menu1-menuItem001")
    actions.move_to_element(menu_relatorios).perform()
    time.sleep(2)

    submenu_movimento = WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located((By.ID, "_ctl7_Menu1-menuItem001-subMenu-menuItem001"))
    )
    actions.move_to_element(submenu_movimento).perform()
    time.sleep(2)

    link_em_loja = WebDriverWait(driver, 10).until(
        EC.element_to_be_clickable((By.ID, "_ctl7_Menu1-menuItem001-subMenu-menuItem001-subMenu-menuItem000"))
    )
    link_em_loja.click()

    print("✅ Chegamos na página de gerar relatório!")

    # --- PASSO 3: GERAR O RELATÓRIO ---
    
    btn_gerar = WebDriverWait(driver, 20).until(
        EC.element_to_be_clickable((By.ID, "btnGerarRel"))
    )

    hoje = datetime.now().strftime('%d/%m/%Y')
    print(f"➡️  Preenchendo o período com a data de hoje: {hoje}")
    
    driver.find_element(By.ID, 'txtDataIni').clear()
    driver.find_element(By.ID, 'txtDataIni').send_keys(hoje)
    
    driver.find_element(By.ID, 'txtDataFim').clear()
    driver.find_element(By.ID, 'txtDataFim').send_keys(hoje)

    time.sleep(1)
    print("➡️  Clicando no botão 'Gerar'...")
    btn_gerar.click()

    # --- PASSO 4: AGUARDAR O DOWNLOAD ---
    print("\n🚀 Relatório gerado! Aguardando o download ser concluído (45 segundos)...")
    print(f"O arquivo PDF será salvo na sua pasta de Downloads: {download_path}")
    
    time.sleep(45)

    print("\n🎉 Processo finalizado com sucesso!")

except Exception as e:
    print(f"\n❌ Ocorreu um erro! O robô foi interrompido.")
    if driver:
        screenshot_path = os.path.join(os.getcwd(), "screenshot_erro.png")
        driver.save_screenshot(screenshot_path)
        print(f"   📸 Uma captura de tela do erro foi salva em: {screenshot_path}")
    print(f"   Detalhe do erro: {e}")

finally:
    if driver:
        driver.quit()