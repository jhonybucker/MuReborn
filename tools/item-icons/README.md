# Ícones dos itens

`render_items.py` gera os ícones de `site/public/images/items/` a partir dos modelos 3D do cliente 99b.
O site procura o ícone pelo nome do item (`divine-staff-of-archangel.webp`) e, se não achar, por
`<grupo>-<indice>.webp`. Item sem ícone aparece só com o nome.

Precisa de Python 3.10+ com `numpy` e `pillow`. `<cliente>` é a pasta do cliente, por exemplo
`C:\Users\...\Desktop\Mu Reborn - Client 99b`.

```sh
# Armas, escudos, asas, colares e anéis: Data/Item
python tools/item-icons/render_items.py "<cliente>/Data/Item" \
  Staff11.bmd=divine-staff-of-archangel Wing02.bmd=wings-of-heaven \
  Shield15.bmd=legendary-shield Shield14.bmd=dragon-shield Mace01.bmd=mace \
  agnecklace.bmd=pendant-of-ability groundring.bmd=ring-of-earth windring.bmd=ring-of-wind \
  --out site/public/images/items

# Elmo, armadura, calça, luvas e botas: Data/Player (renderizados em pé, de frente)
python tools/item-icons/render_items.py "<cliente>/Data/Player" \
  HelmMale08.bmd=sphinx-mask ArmorMale08.bmd=sphinx-armor PantMale08.bmd=sphinx-pants \
  GloveMale08.bmd=sphinx-gloves BootMale08.bmd=sphinx-boots GloveMale07.bmd=scale-gloves \
  --out site/public/images/items
```

Como achar o modelo de um item novo:

- Armas e escudos: prefixo do tipo + (índice + 1) com dois dígitos. `Staff11.bmd` é o cajado de
  índice 10; `Shield15.bmd` é o escudo de índice 14.
- Asas: `Wing01` a `Wing07`, na ordem do jogo (`Wing02` = Wings of Heaven).
- Conjuntos (elmo, armadura, calça, luvas, botas): `HelmMale`, `ArmorMale`, `PantMale`, `GloveMale`,
  `BootMale` + (índice do conjunto + 1). `…Male08` é o Sphinx (índice 7), `…Male07` o Scale.
  Conjuntos de elfa usam `…Elf`, e alguns de outras classes `…Class`.
- Na dúvida, renderize os candidatos e compare pela aparência.

Ainda sem ícone: o conjunto Great Dragon (não existe no 99b original; precisa do `Item.txt` do
servidor para achar o modelo) e o pet Capetinha (o modelo do Imp não está com textura nestas pastas).
