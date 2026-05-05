import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Types "types";

actor {
  type Settings = Types.Settings;
  type Project = Types.Project;

  var settings : ?Settings = null;
  let projects = Map.empty<Text, Project>();
  let modelClaims = Map.empty<Text, Text>();

  public shared func saveSettings(newSettings : Settings) : async () {
    settings := ?newSettings;
  };

  public query func getSettings() : async ?Settings {
    settings;
  };

  public shared func saveCustomPrompt(prompt : Text) : async () {
    switch (settings) {
      case (?currentSettings) {
        settings := ?{ currentSettings with customSystemPrompt = prompt };
      };
      case (null) {
        settings := ?{
          termuxUrl = "";
          openRouterApiKey = "";
          githubToken = "";
          githubRepo = "";
          defaultModel = "";
          masterAiModel = "";
          customSystemPrompt = prompt;
        };
      };
    };
  };

  public query func getCustomPrompt() : async Text {
    switch (settings) {
      case (?currentSettings) { currentSettings.customSystemPrompt };
      case (null) { "" };
    };
  };

  public query func listProjects() : async [Project] {
    projects.values().toArray();
  };

  public shared func createProject(name : Text) : async () {
    switch (projects.get(name)) {
      case (?_) { Runtime.trap("Project already exists") };
      case (null) {
        let project : Project = {
          name;
          created = Time.now();
          lastModified = Time.now();
          aiModel = "";
        };
        projects.add(name, project);
      };
    };
  };

  public shared func deleteProject(name : Text) : async () {
    switch (projects.get(name)) {
      case (null) { Runtime.trap("Project does not exist") };
      case (?project) {
        if (project.aiModel != "") {
          modelClaims.remove(project.aiModel);
        };
        projects.remove(name);
      };
    };
  };

  public shared func setProjectModel(projectName : Text, modelId : Text) : async () {
    switch (projects.get(projectName)) {
      case (null) { Runtime.trap("Project does not exist") };
      case (?project) {
        if (project.aiModel != "") {
          modelClaims.remove(project.aiModel);
        };
        modelClaims.add(modelId, projectName);
        let updatedProject = { project with aiModel = modelId };
        projects.add(projectName, updatedProject);
      };
    };
  };

  public shared func claimMasterModel(modelId : Text) : async () {
    switch (settings) {
      case (?currentSettings) {
        if (currentSettings.masterAiModel != "") {
          modelClaims.remove(currentSettings.masterAiModel);
        };
        modelClaims.add(modelId, "master");
        settings := ?{ currentSettings with masterAiModel = modelId };
      };
      case (null) { Runtime.trap("Settings not initialized") };
    };
  };

  public query func getClaimedModels() : async [(Text, Text)] {
    modelClaims.toArray();
  };
};
