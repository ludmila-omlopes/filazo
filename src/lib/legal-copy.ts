import type { Locale } from "@/lib/i18n";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalDocument = {
  title: string;
  intro: string[];
  sections: LegalSection[];
};

const legalDocuments = {
  en: {
    privacy: {
      title: "Privacy Policy",
      intro: [
        "filazo is a personal game-library service. This policy explains what we collect, why we collect it, and how we handle it.",
        "By using filazo, you understand that your account data, catalog activity, and connected-provider data are processed so the product can store, sync, and display your library.",
      ],
      sections: [
        {
          title: "Information we collect",
          body: [
            "We collect the information you provide directly, such as your display name, email address, password hash, onboarding answers, beta-application details, and anything you submit through notes, reviews, journal entries, CSV uploads, or manual game edits.",
            "When you connect external services, we also store the account identifiers and profile details needed to keep that connection working. Depending on the provider, this can include usernames, avatars, profile links, refresh tokens, and sync metadata.",
          ],
        },
        {
          title: "Catalog and gameplay data",
          body: [
            "filazo stores the games attached to your account, including ownership state, wishlist or backlog status, playtime, completion signals, favorites, import history, and other library-management details.",
            "If you sync Steam, PlayStation, or Xbox, we may store provider-specific IDs and raw sync payloads so the app can match those titles back to one canonical game record without creating duplicates.",
          ],
        },
        {
          title: "Why we use your data",
          body: [
            "We use your data to authenticate you, keep your account available across sessions, import and sync your library, enrich game records, show your profile, and preserve audit history for imports and changes.",
            "If assistant features are enabled, limited library context may also be processed to generate recommendations, summaries, or profile insights. These features are optional and designed around your own catalog data.",
          ],
        },
        {
          title: "Sharing",
          body: [
            "We do not sell your personal information. We share data only with the services needed to run the product, such as authentication providers, connected platform integrations, database or hosting infrastructure, and optional AI providers when those features are used.",
            "Those services receive only the information required for the requested feature to work.",
          ],
        },
        {
          title: "Retention and security",
          body: [
            "We keep data for as long as your account remains active or as long as it is needed to operate the service, preserve import history, or meet legitimate operational needs.",
            "We use reasonable safeguards for stored account data and connected-provider credentials, but no internet service can promise absolute security.",
          ],
        },
        {
          title: "Your choices",
          body: [
            "You can choose whether to connect external providers, whether to use optional assistant features, and what information to add manually to your account.",
            "If you want your account data removed or have privacy questions, contact the project operator through the repository or the contact method provided with the service.",
          ],
        },
        {
          title: "Policy updates",
          body: [
            "This policy may change as filazo changes. When it does, the updated version will be posted on this page.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      intro: [
        "These terms govern your use of filazo. If you use the service, you agree to follow them.",
        "filazo is offered as a game-library and catalog tool. The service may change over time, especially while access is limited or in beta.",
      ],
      sections: [
        {
          title: "Using the service",
          body: [
            "You may use filazo only in a lawful way and only for managing your own game-library information, account profile, and related notes or imports.",
            "You are responsible for the accuracy of the information you upload or connect and for keeping your account credentials secure.",
          ],
        },
        {
          title: "Accounts and access",
          body: [
            "Some parts of filazo require an account. Access may be limited, suspended, or revoked if the service is abused, if eligibility changes, or if beta access expires.",
            "You may not attempt to bypass access controls, impersonate another user, or interfere with the normal operation of the product.",
          ],
        },
        {
          title: "Connected platforms and imported content",
          body: [
            "When you connect Steam, PlayStation, Xbox, Google, YouTube, or other providers, you authorize filazo to use the data needed to complete the requested login, sync, or import flow.",
            "You remain responsible for making sure you have the right to upload files, notes, screenshots, audio, and other content you submit to the service.",
          ],
        },
        {
          title: "Product behavior",
          body: [
            "filazo tries to keep one canonical internal catalog record per game, but imports, provider data, and metadata enrichment are all best-effort features and may be incomplete, unavailable, or imperfect.",
            "The service may add, remove, pause, or change features without notice, especially for experimental or beta functionality.",
          ],
        },
        {
          title: "Intellectual property",
          body: [
            "The filazo product, its design, code, and original content remain the property of their respective owners.",
            "Game titles, cover art, platform marks, and third-party metadata remain the property of their respective rights holders.",
          ],
        },
        {
          title: "No warranty",
          body: [
            "filazo is provided on an as-is and as-available basis. We do not promise uninterrupted availability, perfect accuracy, or fitness for a particular purpose.",
            "To the extent allowed by law, the operator is not liable for data loss, sync failures, third-party outages, or other damages resulting from use of the service.",
          ],
        },
        {
          title: "Changes to these terms",
          body: [
            "These terms may be updated as the product evolves. Continued use of filazo after updates means you accept the revised terms.",
          ],
        },
      ],
    },
  },
  "pt-BR": {
    privacy: {
      title: "Política de Privacidade",
      intro: [
        "A filazo é um serviço pessoal de catálogo de jogos. Esta política explica o que coletamos, por que coletamos e como lidamos com esses dados.",
        "Ao usar a filazo, você entende que os dados da sua conta, a atividade do seu catálogo e os dados de plataformas conectadas podem ser processados para armazenar, sincronizar e exibir sua biblioteca.",
      ],
      sections: [
        {
          title: "Informações que coletamos",
          body: [
            "Coletamos as informações que você fornece diretamente, como nome de exibição, e-mail, hash de senha, respostas de onboarding, dados de inscrição beta e tudo o que você enviar em notas, reviews, diário, uploads de CSV ou edições manuais de jogos.",
            "Quando você conecta serviços externos, também armazenamos os identificadores de conta e os detalhes de perfil necessários para manter essa conexão funcionando. Dependendo da plataforma, isso pode incluir nome de usuário, avatar, link de perfil, refresh tokens e metadados de sincronização.",
          ],
        },
        {
          title: "Dados de catálogo e jogatina",
          body: [
            "A filazo armazena os jogos vinculados à sua conta, incluindo posse, wishlist ou backlog, tempo de jogo, sinais de conclusão, favoritos, histórico de importação e outros detalhes de gerenciamento da biblioteca.",
            "Se você sincronizar Steam, PlayStation ou Xbox, podemos armazenar IDs específicos do provedor e cargas brutas de sincronização para associar esses títulos ao mesmo registro canônico interno sem criar duplicatas.",
          ],
        },
        {
          title: "Por que usamos seus dados",
          body: [
            "Usamos seus dados para autenticar seu acesso, manter sua conta disponível entre sessões, importar e sincronizar sua biblioteca, enriquecer registros de jogos, exibir seu perfil e preservar o histórico de importações e alterações.",
            "Se recursos de assistente estiverem ativados, um contexto limitado da biblioteca também pode ser processado para gerar recomendações, resumos ou sinais de perfil. Esses recursos são opcionais e trabalham a partir do seu próprio catálogo.",
          ],
        },
        {
          title: "Compartilhamento",
          body: [
            "Não vendemos suas informações pessoais. Compartilhamos dados apenas com os serviços necessários para operar o produto, como provedores de autenticação, integrações conectadas, infraestrutura de banco de dados ou hospedagem e provedores opcionais de IA quando esses recursos são usados.",
            "Esses serviços recebem apenas as informações necessárias para que a funcionalidade solicitada funcione.",
          ],
        },
        {
          title: "Retenção e segurança",
          body: [
            "Mantemos os dados enquanto sua conta permanecer ativa ou enquanto eles forem necessários para operar o serviço, preservar o histórico de importações ou atender necessidades operacionais legítimas.",
            "Usamos salvaguardas razoáveis para dados de conta e credenciais de plataformas conectadas, mas nenhum serviço na internet pode prometer segurança absoluta.",
          ],
        },
        {
          title: "Suas escolhas",
          body: [
            "Você pode escolher se quer conectar plataformas externas, se quer usar recursos opcionais de assistente e quais informações deseja adicionar manualmente à sua conta.",
            "Se quiser remover dados da sua conta ou tiver dúvidas sobre privacidade, entre em contato com a responsável pelo projeto pelo repositório ou pelo canal de contato fornecido com o serviço.",
          ],
        },
        {
          title: "Atualizações desta política",
          body: [
            "Esta política pode mudar conforme a filazo muda. Quando isso acontecer, a versão atualizada será publicada nesta página.",
          ],
        },
      ],
    },
    terms: {
      title: "Termos de Uso",
      intro: [
        "Estes termos regulam o uso da filazo. Ao usar o serviço, você concorda em segui-los.",
        "A filazo é oferecida como uma ferramenta de catálogo e biblioteca de jogos. O serviço pode mudar ao longo do tempo, especialmente enquanto o acesso for limitado ou estiver em beta.",
      ],
      sections: [
        {
          title: "Uso do serviço",
          body: [
            "Você só pode usar a filazo de forma lícita e apenas para gerenciar suas próprias informações de biblioteca, perfil de conta e notas ou importações relacionadas.",
            "Você é responsável pela precisão das informações que envia ou conecta e por manter suas credenciais de conta em segurança.",
          ],
        },
        {
          title: "Contas e acesso",
          body: [
            "Algumas partes da filazo exigem conta. O acesso pode ser limitado, suspenso ou revogado se houver abuso do serviço, se a elegibilidade mudar ou se o acesso beta expirar.",
            "Você não pode tentar contornar controles de acesso, se passar por outra pessoa ou interferir no funcionamento normal do produto.",
          ],
        },
        {
          title: "Plataformas conectadas e conteúdo importado",
          body: [
            "Quando você conecta Steam, PlayStation, Xbox, Google, YouTube ou outros provedores, você autoriza a filazo a usar os dados necessários para concluir o login, a sincronização ou a importação solicitada.",
            "Você continua responsável por garantir que tem direito de enviar arquivos, notas, capturas, áudios e outros conteúdos submetidos ao serviço.",
          ],
        },
        {
          title: "Comportamento do produto",
          body: [
            "A filazo tenta manter um único registro canônico interno por jogo, mas importações, dados de provedores e enriquecimento de metadados são recursos de melhor esforço e podem ser incompletos, indisponíveis ou imperfeitos.",
            "O serviço pode adicionar, remover, pausar ou alterar funcionalidades sem aviso prévio, especialmente em recursos experimentais ou de beta.",
          ],
        },
        {
          title: "Propriedade intelectual",
          body: [
            "O produto filazo, seu design, código e conteúdo original permanecem propriedade de seus respectivos titulares.",
            "Títulos de jogos, capas, marcas de plataformas e metadados de terceiros permanecem propriedade de seus respectivos titulares de direitos.",
          ],
        },
        {
          title: "Sem garantias",
          body: [
            "A filazo é fornecida no estado em que se encontra e conforme disponível. Não prometemos disponibilidade ininterrupta, precisão perfeita ou adequação a um fim específico.",
            "Na medida permitida por lei, a responsável pelo serviço não responde por perda de dados, falhas de sincronização, indisponibilidade de terceiros ou outros danos decorrentes do uso da plataforma.",
          ],
        },
        {
          title: "Mudanças nestes termos",
          body: [
            "Estes termos podem ser atualizados conforme o produto evolui. O uso contínuo da filazo depois das atualizações significa aceitação dos termos revisados.",
          ],
        },
      ],
    },
  },
} satisfies Record<Locale, Record<"privacy" | "terms", LegalDocument>>;

export function getLegalDocument(
  locale: Locale,
  document: "privacy" | "terms",
) {
  return legalDocuments[locale][document];
}
