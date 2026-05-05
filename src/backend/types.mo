module {
  public type OldSettings = {
    termuxUrl : Text;
    openRouterApiKey : Text;
    githubToken : Text;
    githubRepo : Text;
    defaultModel : Text;
    masterAiModel : Text;
  };

  public type Settings = {
    termuxUrl : Text;
    openRouterApiKey : Text;
    githubToken : Text;
    githubRepo : Text;
    defaultModel : Text;
    masterAiModel : Text;
    customSystemPrompt : Text;
  };

  public type Project = {
    name : Text;
    created : Int;
    lastModified : Int;
    aiModel : Text;
  };
};
