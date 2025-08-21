(function(){
  try{
    const norm = s => (s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const path = location.pathname;
    const fname = path.substring(path.lastIndexOf('/')+1);
    const baseDec = decodeURIComponent(fname.replace(/\.[^.]+$/, ''));
    const key = norm(baseDec);

    // Mapa: archivo (normalizado) -> imagen en img_establecimiento
    const LOGO = {
      'centro_de_capacitacion_laboral': 'CCL.png',
      'colegio_deportivo_tp_elena_duvauchelle_cabezon': 'CODE .png',
      'colegio_eduardo_llanos_nava': 'Colegio Eduardo LLanos Nava.png',
      'colegio_espana': 'Colegio España.png',
      'colegio_esp_edu_especial_flor_del_inca': 'logo_flor_inca.jpg',
      'colegio_lynch': 'Colegio Lynch.png',
      'colegio_republica_de_croacia': 'Colegio República de Croacia.png',
      'colegio_republica_de_croacia_alt': 'Colegio República de Croacia.png',
      'colegio_republica_de_italia': 'Italia.jpg',
      'colegio_republica_de_italia_alt': 'Italia.jpg',
      'colegio_simon_bolivar': 'Colegio Simon Bolivar.png',
      'colegio_simón_bolívar': 'Colegio Simon Bolivar.png',
      'escuela_almirante_patricio_lynch': 'Colegio Lynch.png',
      'escuela_caleta_chanavayita': 'Escuela Chanavayita.png',
      'escuela_caleta_san_marcos': 'Escuela San Marcos.png',
      'escuela_centenario': 'Escuela Centenario.png',
      'escuela_chipana': 'Chipana.jpg',
      'escuela_de_educacion_especial_flor_del_inca': 'logo_flor_inca.jpg',
      'escuela_especial_de_lenguaje_oasis_del_saber': 'Oasis del Saber.png',
      'escuela_gabriela_mistral': 'Escuela Gabriela Mistral.png',
      'escuela_placido_villarroel': 'Escuela Placido Villarroel V2.png',
      'escuela_placido_villarroel_v2': 'Escuela Placido Villarroel V2.png',
      'escuela_profesor_manuel_castro_ramos': 'logo_castro_ramos.jpg',
      'escuela_thilda_portillo_olivares': 'Escuela Thilda Portillo.png',
      'escuela_violeta_parra': 'Escuela Violeta Parra.png',
      'instituto_comercial_baldomero_wolnitzky': 'Instituto Comercial.png',
      'liceo_bicentenario_domingo_santa_maria': 'Liceo Santa Maria.png',
      'liceo_bicentenario_minero_ss_juan_pablo_ii': 'Liceo Juan Pablo II.png',
      'liceo_ceia': 'Liceo CEIA.png',
      'liceo_libertador_general_bernardo_ohiggins': 'Ohiggins.jpg',
      'liceo_luis_cruz_martinez': 'Liceo Luis Cruz Martinez.png',
      'liceo_politecnico_jose_gutierrez_de_la_fuente': 'Politecnico.png',
      'liceo_politécnico_jose_gutierrez_de_la_fuente': 'Politecnico.png',
      'liceo_tecnico_profesional_de_adultos': 'Liceo Tp de Adultos.png',
      'oasis_del_saber': 'Oasis del Saber.png',
      'ohiggins': 'Ohiggins.jpg',
      'paula_jaraquemada_alquizar': 'Paula Jaraquemada.png',
      'violeta_parra': 'Escuela Violeta Parra.png'
    };

    const imgFile = LOGO[key];
    if(!imgFile) return; // Sin logo conocido

    // Evitar duplicados si ya hay un logo
    if(document.querySelector('.est-logo')) return;

    // CSS mínimo para encabezado y logo
    if(!document.getElementById('est-header-css')){
      const style = document.createElement('style');
      style.id = 'est-header-css';
      style.textContent = `
        .est-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem}
        .est-header .titles{flex:1;min-width:0}
        .est-logo{width:120px;height:120px;object-fit:contain;display:block}
      `;
      document.head.appendChild(style);
    }

    // Construir encabezado
    const header = document.createElement('div');
    header.className = 'est-header';
    const titles = document.createElement('div');
    titles.className = 'titles';

    // h2 "Convivencia Escolar"
    const h2 = document.createElement('h2');
    h2.className = 'Th1';
    h2.textContent = 'Convivencia Escolar';
    titles.appendChild(h2);

    // Usar h1 existente o crear uno
    let h1 = document.querySelector('h1');
    if(!h1){
      h1 = document.createElement('h1');
      const titleTxt = (document.title||'').replace(/\s*-\s*SLEP.*$/i,'').trim() || baseDec.replace(/[_-]+/g,' ').toUpperCase();
      h1.textContent = titleTxt || baseDec.toUpperCase();
    } else {
      // Si existe y no está ya en el header, lo moveremos
      h1 = h1.parentElement === titles ? h1 : h1;
    }
    h1.classList.add('Th2EE');
    titles.appendChild(h1);

    const img = document.createElement('img');
    img.className = 'est-logo';
    img.alt = h1.textContent || 'Logo establecimiento';
    img.src = `../img_establecimiento/${encodeURI(imgFile)}`;
    img.onerror = () => { img.style.display='none'; };

    header.appendChild(titles);
    header.appendChild(img);

    // Insertar al inicio del contenido principal
    const container = document.querySelector('main > section') || document.querySelector('main') || document.body;
    if(container.firstChild){
      container.insertBefore(header, container.firstChild);
    } else {
      container.appendChild(header);
    }
  }catch(e){ console.warn('est-header-logo err', e); }
})();
