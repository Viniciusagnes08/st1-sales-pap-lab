# ST1 Sales PAP Lab: GitHub privado e Vercel de homologacao

## Destino unico para este projeto

- GitHub: `Viniciusagnes08/st1-sales-pap-lab` **privado**, repositorio proprio e independente.
- Branch padrao do novo repositorio: `main`.
- Vercel: novo projeto `st1-sales-pap-web-homologacao` da equipe `vinicius-agnes`.
- Root Directory na Vercel: `web-preview`.
- Framework: `Other`; sem Build Command ou Output Directory customizados.

**Nao use o repositorio `st1-central-comercial` nem o `st1-connect` como destino.**

## Com a integracao GitHub do ChatGPT

A integracao GitHub atualmente disponivel pode gravar arquivos em repositorios existentes, mas nao cria novos repositorios. Crie somente a estrutura vazia no GitHub:

1. Visite https://github.com/new?name=st1-sales-pap-lab
2. Owner `Viniciusagnes08`, nome `st1-sales-pap-lab`, visibilidade **Private**.
3. Nao marque "Add a README file", `.gitignore` nem License: o pacote ja inclui estes arquivos quando aplicavel.
4. Apos a criacao, configure a instalacao do aplicativo GitHub conectado ao ChatGPT para permitir acesso a esse repositorio, caso o acesso esteja restrito a repositorios selecionados.
5. Volte ao chat e confirme que o repositorio privado foi criado. Os arquivos podem entao ser enviados via integracao GitHub, sem copiar tokens no chat.

## Alternativa: upload via Git local

Extraia este ZIP. Dentro da pasta do projeto, execute:

```sh
git init
git add .
git commit -m "feat: ST1 Sales PAP Lab Web e aplicativo de homologacao"
git branch -M main
git remote add origin https://github.com/Viniciusagnes08/st1-sales-pap-lab.git
git push -u origin main
```

Use a autenticacao local do GitHub, nunca envie chaves, tokens ou `.env` a terceiros.

## Deploy Vercel

1. Crie/importa apenas um projeto novo a partir do GitHub `Viniciusagnes08/st1-sales-pap-lab`.
2. Configure **Root Directory `web-preview`** e framework `Other`.
3. Crie uma implantacao **Preview** para homologacao. Evite promover para producao antes de validar a configuracao de acesso.
4. Verifique o hostname de implantacao efetivamente retornado pela Vercel antes de compartilhar.

**Atencao:** `web-preview` e uma demonstracao estatica sem dados reais. O servidor `server/` com SQLite e administracao sem autenticacao multiusuario nao deve ser disponibilizado publicamente. GPS real, cadastro de colaboradores, ofertas comerciais e controle de perfis exigem backend remoto seguro, HTTPS, RBAC, retencao de dados e testes LGPD.

Os binarios Android/iPhone nao fazem parte desta entrega: consulte `mobile/README.md` para a homologacao nativa.
